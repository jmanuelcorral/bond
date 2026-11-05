// `bond decisions`: la memoria de decisiones del repo (sección [decisions] de
// .bond/bond.toml). Los agentes registran con `add` (o la herramienta `record_decision`
// de pi, que llama a este mismo código): bond calcula el id, la autoría (D12) y escribe
// el fichero con el formato de D6. No hay índice compartido (D19): el listado lo da esta
// orden, así que dos ramas paralelas que registran decisiones no chocan al fusionarse.
// Aceptar es solo del usuario, pero desde la conversación: `accept` acepta con
// `--confirmed-by "<lo que dijo el usuario>"` sin terminal (D20) o de forma interactiva
// con ella; sin una de las dos cosas se niega. `check` audita los registros para que la
// memoria no se rompa con el uso.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { t } from "./messages.mts";
import { agents } from "./herdr.mts";
import { configExists, loadConfigOrEmpty } from "./config.mts";
import { repoDecisions, repoRoot } from "./repo.mts";
import { bad, catchDie, die, dim, ok, run } from "./util.mts";
import { runMigrate } from "./decisions-migrate.mts";

export const STATUSES = ["proposed", "accepted", "rejected", "superseded"];

export const decisionsHelp = (): string => t("decisions.help");
export const DECISIONS_HELP = decisionsHelp();

// --- frontmatter ------------------------------------------------------------------------

/** Lo que sale de un fichero Markdown con frontmatter YAML simple. */
export interface Parsed {
	scalars: Record<string, string>;
	lists: Record<string, string[]>;
	body: string;
}

const unq = (s: string) => s.replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1");
const q = (s: string) => JSON.stringify(s);

/**
 * Frontmatter YAML de un fichero de decisión o de un run: claves escalares `k: "v"` y
 * listas (`clave:` con items `- "x"`, o inline `[]`). Devuelve undefined si el texto no
 * arranca con `---` o no cierra.
 */
export function parseFm(text: string): Parsed | undefined {
	// CRLF: en Windows, git con core.autocrlf deja así los ficheros al hacer checkout.
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	if (lines[0]?.trim() !== "---") return undefined;
	const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
	if (end < 0) return undefined;
	const scalars: Record<string, string> = {};
	const lists: Record<string, string[]> = {};
	let listKey: string | undefined;
	for (const line of lines.slice(1, end)) {
		if (!line.trim()) { listKey = undefined; continue; }
		const item = /^\s*-\s+(.*)$/.exec(line);
		if (item && listKey) { lists[listKey].push(unq(item[1].trim())); continue; }
		const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
		if (!m) return undefined;
		const [, key, raw] = m;
		if (raw === "") { listKey = key; lists[key] = []; continue; }
		listKey = undefined;
		if (raw === "[]") { lists[key] = []; continue; }
		scalars[key] = unq(raw.trim());
	}
	return { scalars, lists, body: lines.slice(end + 1).join("\n") };
}

// --- decisiones --------------------------------------------------------------------------

export interface Decision {
	id: string;
	title: string;
	status: string;
	date: string;
	decided_by: string;
	accepted_by: string;
	/** Quién ejecutó la aceptación desde la conversación (D20): user o agent:<kind>[/<nombre>]. */
	accepted_via: string;
	supersedes: string;
	superseded_by: string;
	links: string[];
	body: string;
	/** Ruta relativa al repo del fichero. */
	rel: string;
}

const decisionFields = (p: Parsed): Partial<Decision> => ({
	id: p.scalars.id ?? "",
	title: p.scalars.title ?? "",
	status: p.scalars.status ?? "",
	date: p.scalars.date ?? "",
	decided_by: p.scalars.decided_by ?? "",
	accepted_by: p.scalars.accepted_by ?? "",
	accepted_via: p.scalars.accepted_via ?? "",
	supersedes: p.scalars.supersedes ?? "",
	superseded_by: p.scalars.superseded_by ?? "",
	links: p.lists.links ?? [],
	body: p.body,
});

function decisionFile(d: Decision): string {
	const links = d.links.length ? `links:\n${d.links.map((l) => `  - ${q(l)}`).join("\n")}` : "links: []";
	return `---\nid: ${q(d.id)}\ntitle: ${q(d.title)}\nstatus: ${q(d.status)}\ndate: ${q(d.date)}\ndecided_by: ${q(d.decided_by)}\naccepted_by: ${q(d.accepted_by)}\naccepted_via: ${q(d.accepted_via)}\nsupersedes: ${q(d.supersedes)}\nsuperseded_by: ${q(d.superseded_by)}\n${links}\n---\n${d.body}`;
}

const dirAbs = (root: string, dirRel: string) => join(root, ...dirRel.split("/"));

/** Los ficheros de decisión de <dir> (sin runs/ ni README), con su frontmatter parseado. */
export function loadDecisions(root: string, dirRel: string): Decision[] {
	const dir = dirAbs(root, dirRel);
	if (!existsSync(dir)) return [];
	const out: Decision[] = [];
	for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort().reverse()) {
		const p = parseFm(readFileSync(join(dir, f), "utf8"));
		if (!p) continue;
		out.push({ ...(decisionFields(p) as Omit<Decision, "rel">), rel: `${dirRel}/${f}` });
	}
	return out;
}

const utcToday = () => new Date().toISOString().slice(0, 10);

/** Slug de un título para el id: minúsculas, dígitos y guiones. */
export const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/**
 * Forma canónica de una autoría (D12): `user` y `agent:<kind>[/<nombre>]` tal cual; una
 * pareja `kind/nombre` se normaliza a `agent:kind/nombre`. Lo que no encaja muere: la
 * autoría queda escrita en ficheros que audita `bond decisions check`, y un valor a medias
 * no se arregla solo. Un nombre suelto ("gru") no se acepta a propósito: no se puede
 * saber si es el kind o el nombre, y adivinar mal sale peor que pedirlo explícito.
 */
export function normalizeAuthor(value: string): string {
	const s = value.trim();
	const v = s.startsWith("agent:") || !s.includes("/") ? s : `agent:${s}`;
	if (v === "user" || /^agent:[a-z][a-z0-9_-]*(\/[^\s/]+)?$/.test(v)) return v;
	die(t("decisions.invalid_author", { value: s }));
}

/**
 * Autoría fijada a mano (D12): `BOND_DECISION_AGENT` manda sobre `[decisions] author` de
 * ~/.bond/config.toml. Sirve para que un panel delegado firme con la identidad con la que
 * se habla -el orquestador- en vez del minion que bond arrancó en el worktree (MINIONS en
 * team.mts), que es un nombre de instancia y dice poco de quién decidió.
 */
export function authorOverride(env: NodeJS.ProcessEnv = process.env): string | undefined {
	const raw = env.BOND_DECISION_AGENT?.trim() || globalAuthor();
	return raw ? normalizeAuthor(raw) : undefined;
}

/** `[decisions] author` de la config global; undefined si no hay config o no dice nada. */
function globalAuthor(): string | undefined {
	if (!configExists()) return undefined;
	return loadConfigOrEmpty().decisions?.author?.trim() || undefined;
}

/**
 * Autoría según D12: la fijada a mano si la hay; si no, en un panel de Herdr el agente del
 * panel, y fuera (o sin agente) user. El override va primero porque es lo que el usuario
 * decidió que conste; lo demás es lo que bond puede deducir del entorno.
 */
export function resolveAuthor(): string {
	const fixed = authorOverride();
	if (fixed) return fixed;
	const pane = process.env.HERDR_ENV === "1" ? process.env.HERDR_PANE_ID : undefined;
	if (!pane) return "user";
	const a = agents(10_000).find((x) => x.pane_id === pane && x.agent);
	if (!a?.agent) return "user";
	return a.name ? `agent:${a.agent}/${a.name}` : `agent:${a.agent}`;
}

/** Enlaces de contexto del repo en el momento de registrar: rama y HEAD (si existen). */
function gitLinks(root: string): string[] {
	const out: string[] = [];
	const br = run("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"]);
	if (br.status === 0 && br.stdout.trim() && br.stdout.trim() !== "HEAD") out.push(`branch: ${br.stdout.trim()}`);
	const head = run("git", ["-C", root, "rev-parse", "--short", "HEAD"]);
	if (head.status === 0 && head.stdout.trim()) out.push(`head: ${head.stdout.trim()}`);
	return out;
}

export interface AddInput {
	title: string;
	context?: string;
	decision: string;
	alternatives?: string;
	consequences?: string;
	links?: string[];
	/** Lo que dijo el usuario al aprobarla: la registra ya `accepted` (aceptar al aprobar). */
	confirmed_by?: string;
}

const section = (name: string, text?: string) => (text && text.trim() ? `\n## ${name}\n\n${text.trim()}\n` : "");

function buildBody(in_: AddInput): string {
	return section("Context", in_.context) + section("Decision", in_.decision) + section("Rejected alternatives", in_.alternatives) + section("Consequences", in_.consequences);
}

/** Registra una decisión: fichero con el formato de D6. No toca el README (D19). */
export function addDecision(root: string, dirRel: string, in_: AddInput): { id: string; rel: string; decided_by: string; status: string; accepted_via: string } {
	const title = in_.title?.trim();
	const decision = in_.decision?.trim();
	if (!title) die(t("decisions.need_title"));
	if (!decision) die(t("decisions.need_decision"));
	const dir = dirAbs(root, dirRel);
	mkdirSync(dir, { recursive: true });
	const base = `${utcToday()}-${slugify(title) || "decision"}`;
	let id = base;
	for (let n = 2; existsSync(join(dir, `${id}.md`)); n++) id = `${base}-${n}`;
	const decided_by = resolveAuthor();
	// Aceptar al aprobar: si el usuario ya la aprobó (por ejemplo, con el plan), entra
	// aceptada con su cita; si no, queda proposed para que la revise.
	const confirmed = in_.confirmed_by === undefined ? undefined : in_.confirmed_by.trim();
	if (confirmed === "") die(t("decisions.confirmed_by_empty"));
	const d: Decision = {
		id,
		title,
		status: confirmed ? "accepted" : "proposed",
		date: utcToday(),
		decided_by,
		accepted_by: confirmed ?? "",
		accepted_via: confirmed ? "user" : "",
		supersedes: "",
		superseded_by: "",
		// Sin repetidos: el agente a veces pasa la rama que bond añade de todos modos.
		links: [...new Set([...(in_.links ?? []).map((l) => l.trim()).filter(Boolean), ...gitLinks(root)])],
		body: `\n${buildBody(in_)}`,
		rel: `${dirRel}/${id}.md`,
	};
	writeFileSync(join(dir, `${id}.md`), decisionFile(d));
	return { id, rel: `${dirRel}/${id}.md`, decided_by, status: d.status, accepted_via: d.accepted_via };
}

// --- cambiar estado ------------------------------------------------------------------------

function findDecisionFile(root: string, dirRel: string, id: string): string {
	const f = join(dirAbs(root, dirRel), `${id}.md`);
	if (!existsSync(f)) die(t("decisions.not_found", { id, dir: dirRel }));
	return f;
}

async function confirm(question: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise<string>((res) => rl.question(question, res));
	rl.close();
	return /^y(es)?$/i.test(answer.trim());
}

const hasTty = () => process.stdin.isTTY === true && process.stdout.isTTY === true;

/** Reescribe una decisión cambiando los campos del parche (estado, aceptación, sustitución). */
function patchDecision(root: string, dirRel: string, id: string, patch: Partial<Pick<Decision, "status" | "accepted_by" | "accepted_via" | "supersedes" | "superseded_by">>): Decision {
	const f = findDecisionFile(root, dirRel, id);
	const p = parseFm(readFileSync(f, "utf8"));
	if (!p) die(t("decisions.invalid_fm", { file: `${dirRel}/${id}.md` }));
	const d = { ...(decisionFields(p) as Omit<Decision, "rel">), rel: `${dirRel}/${id}.md` };
	Object.assign(d, patch);
	writeFileSync(f, decisionFile(d));
	return d;
}

/**
 * D20 (sustituye a D13): aceptar, rechazar o sustituir es del usuario, pero puede
 * hacerlo desde la conversación: con `--confirmed-by "<referencia>"` no hace falta
 * terminal —la referencia es lo que el usuario dijo— y queda con `accepted_via` quien
 * lo ejecutó (autoría de D12). Con terminal y sin `--confirmed-by`, se pregunta.
 * Sin ninguna de las dos, se niega: un agente no puede aceptar por su cuenta.
 */
interface ChangeRequest {
	/** "aceptar" | "rechazar" | "sustituir" — para el mensaje de la pregunta interactiva. */
	verb: string;
	/** Estado destino de las decisiones explicitas (no aplica a `supersede`). */
	status?: string;
	ids: string[];
	allProposed: boolean;
	confirmedBy?: string;
	/** Referencia de aceptación para el modo interactivo (--ref de siempre). */
	ref?: string;
	/** Para `supersede`: id de la decisión que sustituye. */
	by?: string;
}

/** Aplica el cambio a cada decisión pedida; informa sin abortar y devuelve si alguna falló. */
async function changeStatus(root: string, dirRel: string, req: ChangeRequest): Promise<boolean> {
	const verbKey = req.verb === "sustituir" ? "decisions.verb_supersede" : req.verb === "rechazar" ? "decisions.verb_reject" : "decisions.verb_accept";
	const verb = t(verbKey);
	const confirmedBy = req.confirmedBy?.trim();
	if (req.confirmedBy !== undefined && !confirmedBy) {
		die(t("decisions.confirmed_by_empty"));
	}
	if (confirmedBy === undefined && !hasTty()) {
		die(t("decisions.user_only_action", { verb }));
	}
	let ids = [...new Set(req.ids)];
	if (req.allProposed) {
		const proposed = loadDecisions(root, dirRel).filter((d) => d.status === "proposed").map((d) => d.id);
		ids = [...new Set([...ids, ...proposed])];
	}
	if (!ids.length) {
		if (req.allProposed) {
			console.log(dim(t("decisions.nothing_to_action", { dir: dirRel, verb })));
			return false;
		}
		die(t("decisions.missing_id", { sub: req.verb === "sustituir" ? "supersede" : req.verb === "rechazar" ? "reject" : "accept" }));
	}
	if (req.by && ids.includes(req.by)) die(t("decisions.supersede_self", { id: req.by }));
	if (req.by) findDecisionFile(root, dirRel, req.by);

	let failed = false;
	for (const id of ids) {
		const f = join(dirAbs(root, dirRel), `${id}.md`);
		if (!existsSync(f)) {
			console.error(`${bad("✗")} ${t("decisions.err_not_in_dir", { id, dir: dirRel })}`);
			failed = true;
			continue;
		}
		const p = parseFm(readFileSync(f, "utf8"));
		if (!p) {
			console.error(`${bad("✗")} ${t("decisions.err_invalid_fm", { file: `${dirRel}/${id}.md` })}`);
			failed = true;
			continue;
		}
		const status = p.scalars.status ?? "";
		if (req.status && status !== "proposed") {
			console.error(`${bad("✗")} ${t("decisions.err_not_proposed", { id, status })}`);
			failed = true;
			continue;
		}
		if (req.verb === "sustituir" && status === "superseded") {
			console.error(`${bad("✗")} ${t("decisions.err_already_superseded", { id, by: p.scalars.superseded_by })}`);
			failed = true;
			continue;
		}
		const author = resolveAuthor();
		const decidedBy = p.scalars.decided_by ?? "";
		if (author !== "user" && author === decidedBy) {
			console.error(`${bad("✗")} ${t("decisions.err_same_author", { id, author, verb })}`);
			failed = true;
			continue;
		}
		if (!confirmedBy && !(await confirm(t("decisions.confirm_prompt", { verb, id })))) {
			console.log(dim(t("decisions.cancelled", { id })));
			continue;
		}
		const patch: Partial<Pick<Decision, "status" | "accepted_by" | "accepted_via" | "supersedes" | "superseded_by">> = {};
		// Con --confirmed-by: la referencia es lo que dijo el usuario y accepted_via quién
		// aceptó ("user", B1 de #82). En interactivo, accepted_by queda con --ref si se dio.
		if (confirmedBy) {
			patch.accepted_by = confirmedBy;
			patch.accepted_via = "user";
		} else if (req.ref) {
			patch.accepted_by = req.ref;
		}
		if (req.verb === "sustituir") {
			patch.status = "superseded";
			patch.superseded_by = req.by!;
			patchDecision(root, dirRel, id, patch);
			// La nueva referencia a la vieja en `supersedes`; ella sigue siendo propuesta
			// hasta que el usuario la acepte por su cuenta.
			patchDecision(root, dirRel, req.by!, { supersedes: id });
			console.log(`${ok("~")} ${dirRel}/${id}.md  ${dim(t("decisions.superseded_by", { by: req.by! }))}`);
		} else {
			patch.status = req.status!;
			const d = patchDecision(root, dirRel, id, patch);
			const via = d.accepted_via ? ` · via ${d.accepted_via}` : "";
			console.log(`${ok("~")} ${d.rel}  ${dim(`${d.status}${d.accepted_by ? ` · ${d.accepted_by}` : ""}${via}`)}`);
		}
	}
	return failed;
}

// --- check ---------------------------------------------------------------------------------

export interface DecisionsReport {
	errors: string[];
	counts: Record<string, number>;
	total: number;
}

/** Trailers `Decision: <id>` de todos los commits del repo (último párrafo de cada mensaje). */
export function decisionTrailers(root: string): string[] {
	const r = run("git", ["-C", root, "log", "HEAD", "--format=%B\x1e"]);
	if (r.status !== 0) return [];
	const out: string[] = [];
	for (const msg of r.stdout.split("\x1e")) {
		const trimmed = msg.trim();
		if (!trimmed) continue;
		const last = trimmed.split(/\n[ \t]*\n/).pop() ?? "";
		for (const m of last.matchAll(/^Decision:\s*(.+)$/gm)) out.push(m[1].trim());
	}
	return out;
}

/** Audita la memoria: ficheros, ids, sustituciones, trailers e índice. */
export function checkDecisions(root: string, dirRel: string): DecisionsReport {
	const errors: string[] = [];
	const counts: Record<string, number> = {};
	const dir = dirAbs(root, dirRel);
	const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort() : [];
	const byId = new Map<string, { rel: string; p: Parsed }>();
	for (const f of files) {
		const rel = `${dirRel}/${f}`;
		const p = parseFm(readFileSync(join(dir, f), "utf8"));
		if (!p) {
			errors.push(t("decisions.check_no_fm", { file: rel }));
			continue;
		}
		const s = p.scalars;
		const missing = ["id", "title", "status", "date", "decided_by"].filter((k) => !s[k]);
		if (missing.length) errors.push(t("decisions.check_missing_fields", { file: rel, fields: missing.join(", ") }));
		if (s.status && !STATUSES.includes(s.status)) errors.push(t("decisions.check_bad_status", { file: rel, status: s.status, allowed: STATUSES.join(", ") }));
		const wantId = f.slice(0, -3);
		if (s.id && s.id !== wantId) errors.push(t("decisions.check_id_mismatch", { file: rel, id: s.id, want: wantId }));
		if (s.id) {
			if (byId.has(s.id)) errors.push(t("decisions.check_duplicate_id", { file: rel, id: s.id, other: byId.get(s.id)!.rel }));
			else byId.set(s.id, { rel, p });
		}
		counts[s.status || t("decisions.no_status")] = (counts[s.status || t("decisions.no_status")] ?? 0) + 1;
	}
	for (const { rel, p } of byId.values()) {
		for (const key of ["supersedes", "superseded_by"] as const) {
			const ref = p.scalars[key];
			if (ref && !byId.has(ref)) errors.push(t("decisions.check_broken_ref", { file: rel, key, ref, dir: dirRel }));
		}
		// accepted_via es opcional (las decisiones aceptadas en terminal no lo llevan); si
		// está, tiene que ser una autoría válida: user o agent:<kind>[/<nombre>] (D20).
		const via = p.scalars.accepted_via;
		if (via && !/^(user|agent:[a-z0-9._-]+(\/[A-Za-z0-9._-]+)?)$/.test(via)) {
			errors.push(t("decisions.check_bad_accepted_via", { file: rel, via }));
		}
		if (p.scalars.status === "accepted" && via && via !== "user" && via === p.scalars.decided_by) {
			errors.push(t("decisions.check_same_accepted_via", { file: rel, author: via }));
		}
	}
	for (const tTrailer of decisionTrailers(root)) {
		if (!byId.has(tTrailer)) errors.push(t("decisions.check_broken_trailer", { trailer: tTrailer, dir: dirRel }));
	}
	// El README no se audita (D19): no hay índice que mantener al día; los que se crearon
	// con tabla siguen siendo válidos.
	return { errors, counts, total: byId.size };
}

// --- doctor ---------------------------------------------------------------------------------

export interface DecisionsDoctor {
	level: "ok" | "warn" | "fail";
	name: string;
	detail: string;
	fix?: string;
}

/**
 * La fila de decisiones para `bond doctor`: errores de check y propuestas pendientes.
 * undefined si el repo no usa la memoria (sin [decisions]) o si la config no se puede leer.
 */
export function decisionsDoctor(root: string): DecisionsDoctor | undefined {
	const { value: dec, error } = catchDie(() => repoDecisions(root));
	if (error !== undefined || !dec) return undefined;
	if (!existsSync(dirAbs(root, dec.dir))) return { level: "warn", name: "decisiones", detail: t("decisions.doctor_dir_missing", { dir: dec.dir }), fix: "bond sync" };
	const { value: rep, error: checkError } = catchDie(() => checkDecisions(root, dec.dir));
	if (checkError !== undefined) return { level: "fail", name: "decisiones", detail: t("decisions.doctor_check_failed", { error: checkError }), fix: "bond decisions check" };
	if (rep!.errors.length) return { level: "fail", name: "decisiones", detail: t("decisions.doctor_errors", { count: rep!.errors.length, dir: dec.dir, first: rep!.errors[0] }), fix: "bond decisions check" };
	const proposed = rep!.counts.proposed ?? 0;
	if (proposed) return { level: "warn", name: "decisiones", detail: t("decisions.doctor_proposed", { proposed, total: rep!.total, dir: dec.dir }), fix: `bond decisions accept <id>` };
	return { level: "ok", name: "decisiones", detail: t("decisions.doctor_all_ok", { total: rep!.total, dir: dec.dir }) };
}

// --- CLI ------------------------------------------------------------------------------------

interface Args {
	pos: string[];
	opts: Record<string, string>;
	links: string[];
	json: boolean;
}

const VALUE_OPTS = ["--title", "--context", "--decision", "--alternatives", "--consequences", "--link", "--ref", "--confirmed-by", "--by", "--status", "--agent"];

function parseArgs(args: string[]): Args {
	const pos: string[] = [];
	const opts: Record<string, string> = {};
	const links: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--json" || a === "--stdin" || a === "--all-proposed" || a === "--dry-run") opts[a] = "";
		else if (VALUE_OPTS.includes(a)) {
			const v = args[++i];
			if (v === undefined) die(t("decisions.opt_needs_value", { opt: a }));
			if (a === "--link") links.push(v);
			else opts[a] = v;
		} else if (a.startsWith("-")) die(t("decisions.unknown_opt", { opt: a }));
		else pos.push(a);
	}
	return { pos, opts, links, json: opts["--json"] === "" };
}

/** La config de decisiones del repo, o null si no la usa (para el mensaje explicativo). */
function memory(root: string): { dir: string } | null {
	return repoDecisions(root) ?? null;
}

const noMemory = (dir: string) =>
	console.log(t("decisions.no_memory", { dir: dim(dir) }));

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
}

async function runAdd(root: string, dir: string, a: Args): Promise<void> {
	let input: AddInput;
	if (a.opts["--stdin"] === "" || a.pos.includes("--stdin")) {
		const text = (await readStdin()).trim();
		if (!text) die(t("decisions.stdin_empty"));
		try {
			input = JSON.parse(text) as AddInput;
		} catch (e) {
			die(t("decisions.stdin_invalid_json", { error: (e as Error).message }));
		}
		input.links = [...(input.links ?? []), ...a.links];
		if (a.opts["--confirmed-by"] !== undefined) input.confirmed_by = a.opts["--confirmed-by"];
	} else {
		input = { title: a.opts["--title"] ?? "", context: a.opts["--context"], decision: a.opts["--decision"] ?? "", alternatives: a.opts["--alternatives"], consequences: a.opts["--consequences"], links: a.links, confirmed_by: a.opts["--confirmed-by"] };
	}
	const { id, rel, decided_by, status, accepted_via } = addDecision(root, dir, input);
	if (a.json) console.log(JSON.stringify({ id, path: rel, status, decided_by, accepted_via }));
	else if (status === "accepted") console.log(`${ok("+")} ${rel}  ${dim(`accepted · ${input.confirmed_by?.trim()} · via ${accepted_via}`)}`);
	else console.log(`${ok("+")} ${rel}  ${dim(t("decisions.add_proposed_ack", { author: decided_by, id }))}`);
}

export async function decisions(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	const root = repoRoot();
	const known = ["add", "accept", "reject", "supersede", "show", "runs", "check", "migrate"];
	const name = known.includes(sub ?? "") ? sub! : undefined;
	const a = parseArgs(name ? rest : args);
	const dec = memory(root);
	if (!dec) {
		if (name === "add") die(t("decisions.err_no_memory"));
		return noMemory(root);
	}
	if (!name) {
		if (sub && !sub.startsWith("-")) die(t("decisions.unknown_subcommand", { sub }));
		if (a.opts["--status"] && !STATUSES.includes(a.opts["--status"])) die(t("decisions.bad_status_flag", { statuses: STATUSES.join(", ") }));
		const ds = loadDecisions(root, dec.dir).filter((d) => (!a.opts["--status"] || d.status === a.opts["--status"]) && (!a.opts["--agent"] || d.decided_by.includes(a.opts["--agent"])));
		if (a.json) return console.log(JSON.stringify(ds));
		if (!ds.length) return console.log(dim(t("decisions.empty_list", { dir: dec.dir })));
		const w = Math.max(...ds.map((d) => d.id.length));
		for (const d of ds) console.log(`${d.id.padEnd(w)}  ${d.status.padEnd(10)}  ${d.decided_by.padEnd(22)}  ${d.title}`);
		return;
	}
	switch (name) {
		case "add":
			return runAdd(root, dec.dir, a);
		case "accept": {
			const failed = await changeStatus(root, dec.dir, { verb: "aceptar", status: "accepted", ids: a.pos, allProposed: a.opts["--all-proposed"] === "", confirmedBy: a.opts["--confirmed-by"], ref: a.opts["--ref"] });
			if (failed) process.exitCode = 1;
			return;
		}
		case "reject": {
			const failed = await changeStatus(root, dec.dir, { verb: "rechazar", status: "rejected", ids: a.pos, allProposed: a.opts["--all-proposed"] === "", confirmedBy: a.opts["--confirmed-by"], ref: a.opts["--ref"] });
			if (failed) process.exitCode = 1;
			return;
		}
		case "supersede": {
			const by = a.opts["--by"] ?? die(t("decisions.supersede_needs_by"));
			const failed = await changeStatus(root, dec.dir, { verb: "sustituir", ids: a.pos, allProposed: a.opts["--all-proposed"] === "", confirmedBy: a.opts["--confirmed-by"], ref: a.opts["--ref"], by });
			if (failed) process.exitCode = 1;
			return;
		}
		case "show": {
			const id = a.pos[0] ?? die(t("decisions.show_usage"));
			const own = join(dirAbs(root, dec.dir), `${id}.md`);
			const asRun = join(dirAbs(root, dec.dir), "runs", `${id}.md`);
			const f = existsSync(own) ? own : existsSync(asRun) ? asRun : findDecisionFile(root, dec.dir, id);
			return console.log(readFileSync(f, "utf8").trimEnd());
		}
		case "runs": {
			const dir = join(dirAbs(root, dec.dir), "runs");
			const runs = existsSync(dir)
				? readdirSync(dir)
						.filter((f) => f.endsWith(".md"))
						.sort()
						.reverse()
						.map((f) => ({ file: `${dec.dir}/runs/${f}`, fm: parseFm(readFileSync(join(dir, f), "utf8")) }))
						.filter((r): r is { file: string; fm: Parsed } => !!r.fm)
				: [];
			const who = (r: Parsed) => `${r.scalars.agent ?? ""} ${r.scalars.kind ?? ""}`;
			const filtered = a.opts["--agent"] ? runs.filter((r) => who(r.fm).includes(a.opts["--agent"]!)) : runs;
			if (a.json) return console.log(JSON.stringify(filtered.map((r) => ({ file: r.file, ...r.fm.scalars, commits: r.fm.lists.commits ?? [], decisions: r.fm.lists.decisions ?? [] }))));
			if (!filtered.length) return console.log(dim(t("decisions.empty_runs", { dir: dec.dir })));
			const n = (xs?: string[]) => xs?.length ?? 0;
			for (const r of filtered) console.log(`${r.file}  ${dim(`${r.fm.scalars.kind ?? "?"}/${r.fm.scalars.agent ?? "?"} · ${r.fm.scalars.branch ?? "?"} · ${r.fm.scalars.status ?? "?"} · ${t("decisions.runs_counts", { commits: n(r.fm.lists.commits), decisions: n(r.fm.lists.decisions) })}`)}`);
			return;
		}
		case "migrate":
			runMigrate(root, dec.dir, { dryRun: a.opts["--dry-run"] !== undefined, json: a.json });
			return;
		case "check": {
			const rep = checkDecisions(root, dec.dir);
			if (a.json) return console.log(JSON.stringify(rep));
			for (const e of rep.errors) console.log(`${bad("✗")} ${e}`);
			const parts = STATUSES.filter((s) => rep.counts[s]).map((s) => `${rep.counts[s]} ${s}`);
			if (!rep.errors.length) console.log(`${ok("✓")} ${t("decisions.check_ok", { dir: dec.dir, total: rep.total, parts: parts.length ? ` (${parts.join(", ")})` : "" })}`);
			else process.exitCode = 1;
			return;
		}
	}
}
