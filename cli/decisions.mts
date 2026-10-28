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
import { agents } from "./herdr.mts";
import { repoDecisions, repoRoot } from "./repo.mts";
import { bad, catchDie, die, dim, ok, run } from "./util.mts";

export const STATUSES = ["proposed", "accepted", "rejected", "superseded"];

export const DECISIONS_HELP = `Uso: bond decisions [subcomando] [opciones]

La memoria de decisiones del repo ([decisions] en .bond/bond.toml). Sin subcomando,
lista las decisiones.

  (lista) [--status <s>] [--agent <a>] [--json]
            Decisiones del repo, las más recientes primero.
  add --title <t> [--context <c>] --decision <d> [--alternatives <a>]
      [--consequences <c>] [--link <ref>]... [--confirmed-by <ref>] [--json]
            Registra una decisión: bond calcula el id (YYYY-MM-DD-slug), la autoría
            (desde el panel de Herdr, agent:<kind>/<nombre>; fuera, user) y escribe el
            fichero. No toca ningún índice: el listado lo da esta orden (así las ramas
            paralelas no chocan). Entra como "proposed"; con --confirmed-by "<lo que
            dijo el usuario>" (porque ya la aprobó, por ejemplo con el plan) entra
            "accepted" con esa cita y accepted_via. El cuerpo queda con los
            apartados en inglés: Context / Decision / Rejected alternatives / Consequences
            (este solo si pasas --consequences). Con --stdin, el mismo objeto en JSON
            por la entrada estándar: {"title","context","decision","alternatives",
            "consequences","links","confirmed_by"}.
  accept <id>... [--ref <aceptación>] [--confirmed-by "<lo que dijo el usuario>"] [--all-proposed]
            La pasa a "accepted". Es solo del usuario, pero puede hacerlo desde la
            conversación: con --confirmed-by (una referencia a sus palabras) no hace
            falta terminal y la decisión guarda además accepted_via: quién lo ejecutó
            (agent:<kind>/<nombre> desde un panel de Herdr, user fuera). Con terminal y
            sin --confirmed-by, pregunta. Sin una cosa ni otra, se niega. Admite varios
            ids y --all-proposed; un id desconocido o no "proposed" se informa sin
            abortar los demás (salida != 0 si alguno falló). --confirmed-by vacío se rechaza.
  reject <id>... [--ref <motivo>] [--confirmed-by <ref>] [--all-proposed]
            La pasa a "rejected" (misma confirmación).
  supersede <id>... --by <nueva> [--confirmed-by <ref>] [--all-proposed]
            Las sustituye: las viejas quedan "superseded" y la nueva las referencia en
            "supersedes" (misma confirmación).
  show <id>                       El fichero entero de una decisión (o de un run, si el
                                  id es de uno en <dir>/runs/).
  runs [--agent <a>] [--json]     Los runs (encargos a agentes) de <dir>/runs/, con los
                                  commits de su rama y las decisiones de ese agente.
  check                           Audita la memoria: frontmatter, ids, duplicados,
                                  sustituciones y trailers Decision:. Sale con 1 si hay
                                  errores. El README no se audita: no hay índice que
                                  mantener al día.

  --json     Salida JSON estable en lista, add, runs y check.
  -h, --help Esta ayuda.

Sin la sección [decisions], solo "add" falla (dice cómo activarla); lo demás sale con 0
explicando que el repo no usa la memoria.`;

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

/** Autoría según D12: en un panel de Herdr, el agente del panel; fuera (o sin agente), user. */
export function resolveAuthor(): string {
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
export function addDecision(root: string, dirRel: string, in_: AddInput): { id: string; rel: string; decided_by: string; status: string } {
	const title = in_.title?.trim();
	const decision = in_.decision?.trim();
	if (!title) die('add necesita un título (--title "..." o "title" en el JSON)');
	if (!decision) die('add necesita la decisión (--decision "..." o "decision" en el JSON)');
	const dir = dirAbs(root, dirRel);
	mkdirSync(dir, { recursive: true });
	const base = `${utcToday()}-${slugify(title) || "decision"}`;
	let id = base;
	for (let n = 2; existsSync(join(dir, `${id}.md`)); n++) id = `${base}-${n}`;
	const decided_by = resolveAuthor();
	// Aceptar al aprobar: si el usuario ya la aprobó (por ejemplo, con el plan), entra
	// aceptada con su cita; si no, queda proposed para que la revise.
	const confirmed = in_.confirmed_by === undefined ? undefined : in_.confirmed_by.trim();
	if (confirmed === "") die("--confirmed-by necesita una referencia no vacía: lo que dijo el usuario (bond decisions --help)");
	const d: Decision = {
		id,
		title,
		status: confirmed ? "accepted" : "proposed",
		date: utcToday(),
		decided_by,
		accepted_by: confirmed ?? "",
		accepted_via: confirmed ? decided_by : "",
		supersedes: "",
		superseded_by: "",
		// Sin repetidos: el agente a veces pasa la rama que bond añade de todos modos.
		links: [...new Set([...(in_.links ?? []).map((l) => l.trim()).filter(Boolean), ...gitLinks(root)])],
		body: `\n${buildBody(in_)}`,
		rel: `${dirRel}/${id}.md`,
	};
	writeFileSync(join(dir, `${id}.md`), decisionFile(d));
	return { id, rel: `${dirRel}/${id}.md`, decided_by, status: d.status };
}

// --- cambiar estado ------------------------------------------------------------------------

function findDecisionFile(root: string, dirRel: string, id: string): string {
	const f = join(dirAbs(root, dirRel), `${id}.md`);
	if (!existsSync(f)) die(`no existe la decisión ${id} en ${dirRel}/ (bond decisions para ver las que hay)`);
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
	if (!p) die(`${dirRel}/${id}.md: sin frontmatter válido; arreglalo antes (bond decisions check)`);
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
	const confirmedBy = req.confirmedBy?.trim();
	if (req.confirmedBy !== undefined && !confirmedBy) {
		die("--confirmed-by necesita una referencia no vacía: lo que dijo el usuario (bond decisions --help)");
	}
	if (confirmedBy === undefined && !hasTty()) {
		die(`${req.verb} la hace solo el usuario: con terminal interactiva y confirmación, o desde la conversación con --confirmed-by "<lo que dijo el usuario>". Desde el shell de un agente sin una cosa ni la otra no se puede (bond decisions --help)`);
	}
	let ids = [...new Set(req.ids)];
	if (req.allProposed) {
		const proposed = loadDecisions(root, dirRel).filter((d) => d.status === "proposed").map((d) => d.id);
		ids = [...new Set([...ids, ...proposed])];
	}
	if (!ids.length) {
		if (req.allProposed) {
			console.log(dim(`sin decisiones "proposed" en ${dirRel}/: nada que ${req.verb}.`));
			return false;
		}
		die(`falta al menos un id (o --all-proposed) (bond decisions ${req.verb === "sustituir" ? "supersede" : req.verb === "rechazar" ? "reject" : "accept"} --help)`);
	}
	if (req.by && ids.includes(req.by)) die(`supersede: --by no puede ser una de las decisiones sustituidas (${req.by})`);
	if (req.by) findDecisionFile(root, dirRel, req.by);

	let failed = false;
	for (const id of ids) {
		const f = join(dirAbs(root, dirRel), `${id}.md`);
		if (!existsSync(f)) {
			console.error(`${bad("✗")} ${id}: no existe en ${dirRel}/`);
			failed = true;
			continue;
		}
		const p = parseFm(readFileSync(f, "utf8"));
		if (!p) {
			console.error(`${bad("✗")} ${dirRel}/${id}.md: sin frontmatter valido; arreglalo antes (bond decisions check)`);
			failed = true;
			continue;
		}
		const status = p.scalars.status ?? "";
		if (req.status && status !== "proposed") {
			console.error(`${bad("✗")} ${id}: no es "proposed" (está en "${status}"), se omite`);
			failed = true;
			continue;
		}
		if (req.verb === "sustituir" && status === "superseded") {
			console.error(`${bad("✗")} ${id}: ya está sustituida por ${p.scalars.superseded_by}, se omite`);
			failed = true;
			continue;
		}
		if (!confirmedBy && !(await confirm(`¿${req.verb} la decisión ${id}? [y/N] `))) {
			console.log(dim(`cancelado: ${id} no cambia.`));
			continue;
		}
		const patch: Partial<Pick<Decision, "status" | "accepted_by" | "accepted_via" | "supersedes" | "superseded_by">> = {};
		// Con --confirmed-by: la referencia es lo que dijo el usuario y accepted_via quien
		// lo ejecutó (D20). En interactivo, accepted_by queda con --ref si se dio.
		if (confirmedBy) {
			patch.accepted_by = confirmedBy;
			patch.accepted_via = resolveAuthor();
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
			console.log(`${ok("~")} ${dirRel}/${id}.md  ${dim(`superseded por ${req.by}`)}`);
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
	const r = run("git", ["-C", root, "log", "--all", "--format=%B\x1e"]);
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
			errors.push(`${rel}: sin frontmatter YAML (o mal cerrado)`);
			continue;
		}
		const s = p.scalars;
		const missing = ["id", "title", "status", "date", "decided_by"].filter((k) => !s[k]);
		if (missing.length) errors.push(`${rel}: faltan campos: ${missing.join(", ")}`);
		if (s.status && !STATUSES.includes(s.status)) errors.push(`${rel}: status "${s.status}" no es uno de ${STATUSES.join(", ")}`);
		const wantId = f.slice(0, -3);
		if (s.id && s.id !== wantId) errors.push(`${rel}: id "${s.id}" no coincide con el nombre del fichero (${wantId})`);
		if (s.id) {
			if (byId.has(s.id)) errors.push(`${rel}: id duplicada "${s.id}" (también en ${byId.get(s.id)!.rel})`);
			else byId.set(s.id, { rel, p });
		}
		counts[s.status || "sin estado"] = (counts[s.status || "sin estado"] ?? 0) + 1;
	}
	for (const { rel, p } of byId.values()) {
		for (const key of ["supersedes", "superseded_by"] as const) {
			const ref = p.scalars[key];
			if (ref && !byId.has(ref)) errors.push(`${rel}: ${key} apunta a "${ref}", que no existe en ${dirRel}/`);
		}
		// accepted_via es opcional (las decisiones aceptadas en terminal no lo llevan); si
		// está, tiene que ser una autoría válida: user o agent:<kind>[/<nombre>] (D20).
		const via = p.scalars.accepted_via;
		if (via && !/^(user|agent:[a-z0-9._-]+(\/[A-Za-z0-9._-]+)?)$/.test(via)) {
			errors.push(`${rel}: accepted_via "${via}" no es "user" ni "agent:<kind>[/<nombre>]"`);
		}
	}
	for (const t of decisionTrailers(root)) {
		if (!byId.has(t)) errors.push(`trailers Decision: apuntan a "${t}", que no existe en ${dirRel}/`);
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
	if (!existsSync(dirAbs(root, dec.dir))) return { level: "warn", name: "decisiones", detail: `${dec.dir}/ no existe todavía (ejecuta bond sync)`, fix: "bond sync" };
	const { value: rep, error: checkError } = catchDie(() => checkDecisions(root, dec.dir));
	if (checkError !== undefined) return { level: "fail", name: "decisiones", detail: `no se pudo comprobar: ${checkError}`, fix: "bond decisions check" };
	if (rep!.errors.length) return { level: "fail", name: "decisiones", detail: `${rep!.errors.length} error(es) en ${dec.dir}/: ${rep!.errors[0]}`, fix: "bond decisions check" };
	const proposed = rep!.counts.proposed ?? 0;
	if (proposed) return { level: "warn", name: "decisiones", detail: `${proposed} propuesta(s) esperando aceptación · ${rep!.total} en ${dec.dir}/`, fix: `bond decisions accept <id>` };
	return { level: "ok", name: "decisiones", detail: `${rep!.total} decisiones, ninguna pendiente en ${dec.dir}/` };
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
		if (a === "--json" || a === "--stdin" || a === "--all-proposed") opts[a] = "";
		else if (VALUE_OPTS.includes(a)) {
			const v = args[++i];
			if (v === undefined) die(`${a} necesita un valor (bond decisions --help)`);
			if (a === "--link") links.push(v);
			else opts[a] = v;
		} else if (a.startsWith("-")) die(`opción desconocida: ${a} (bond decisions --help)`);
		else pos.push(a);
	}
	return { pos, opts, links, json: opts["--json"] === "" };
}

/** La config de decisiones del repo, o null si no la usa (para el mensaje explicativo). */
function memory(root: string): { dir: string } | null {
	return repoDecisions(root) ?? null;
}

const noMemory = (dir: string) =>
	console.log(`${dim(dir)}: este repo no usa la memoria de decisiones. Para activarla, añade la sección [decisions] a .bond/bond.toml (o bond init) y ejecuta bond sync.`);

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString("utf8");
}

async function runAdd(root: string, dir: string, a: Args): Promise<void> {
	let input: AddInput;
	if (a.opts["--stdin"] === "" || a.pos.includes("--stdin")) {
		const text = (await readStdin()).trim();
		if (!text) die("--stdin necesita un objeto JSON por la entrada estándar (bond decisions --help)");
		try {
			input = JSON.parse(text) as AddInput;
		} catch (e) {
			die(`--stdin no es JSON válido: ${(e as Error).message}`);
		}
		input.links = [...(input.links ?? []), ...a.links];
		if (a.opts["--confirmed-by"] !== undefined) input.confirmed_by = a.opts["--confirmed-by"];
	} else {
		input = { title: a.opts["--title"] ?? "", context: a.opts["--context"], decision: a.opts["--decision"] ?? "", alternatives: a.opts["--alternatives"], consequences: a.opts["--consequences"], links: a.links, confirmed_by: a.opts["--confirmed-by"] };
	}
	const { id, rel, decided_by, status } = addDecision(root, dir, input);
	if (a.json) console.log(JSON.stringify({ id, path: rel, status, decided_by }));
	else if (status === "accepted") console.log(`${ok("+")} ${rel}  ${dim(`accepted · ${input.confirmed_by?.trim()} · via ${decided_by}`)}`);
	else console.log(`${ok("+")} ${rel}  ${dim(`proposed · decidido por ${decided_by} · acepta con: bond decisions accept ${id}`)}`);
}

export async function decisions(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	const root = repoRoot();
	const known = ["add", "accept", "reject", "supersede", "show", "runs", "check"];
	const name = known.includes(sub ?? "") ? sub! : undefined;
	const a = parseArgs(name ? rest : args);
	const dec = memory(root);
	if (!dec) {
		if (name === "add") die(`este repo no tiene la memoria de decisiones activada: añade la sección [decisions] a .bond/bond.toml (bond init la propone con la skill decision-record) y ejecuta bond sync`);
		return noMemory(root);
	}
	if (!name) {
		if (sub && !sub.startsWith("-")) die(`subcomando desconocido: ${sub} (bond decisions --help)`);
		if (a.opts["--status"] && !STATUSES.includes(a.opts["--status"])) die(`--status tiene que ser uno de ${STATUSES.join(", ")}`);
		const ds = loadDecisions(root, dec.dir).filter((d) => (!a.opts["--status"] || d.status === a.opts["--status"]) && (!a.opts["--agent"] || d.decided_by.includes(a.opts["--agent"])));
		if (a.json) return console.log(JSON.stringify(ds));
		if (!ds.length) return console.log(dim(`sin decisiones en ${dec.dir}/ (bond decisions add --title ... --decision ...)`));
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
			const by = a.opts["--by"] ?? die("supersede necesita --by <id de la decisión que la sustituye>");
			const failed = await changeStatus(root, dec.dir, { verb: "sustituir", ids: a.pos, allProposed: a.opts["--all-proposed"] === "", confirmedBy: a.opts["--confirmed-by"], ref: a.opts["--ref"], by });
			if (failed) process.exitCode = 1;
			return;
		}
		case "show": {
			const id = a.pos[0] ?? die("uso: bond decisions show <id>");
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
			if (!filtered.length) return console.log(dim(`sin runs en ${dec.dir}/runs/`));
			const n = (xs?: string[]) => xs?.length ?? 0;
			for (const r of filtered) console.log(`${r.file}  ${dim(`${r.fm.scalars.kind ?? "?"}/${r.fm.scalars.agent ?? "?"} · ${r.fm.scalars.branch ?? "?"} · ${r.fm.scalars.status ?? "?"} · ${n(r.fm.lists.commits)} commit(s) · ${n(r.fm.lists.decisions)} decisión(es)`)}`);
			return;
		}
		case "check": {
			const rep = checkDecisions(root, dec.dir);
			if (a.json) return console.log(JSON.stringify(rep));
			for (const e of rep.errors) console.log(`${bad("✗")} ${e}`);
			const parts = STATUSES.filter((s) => rep.counts[s]).map((s) => `${rep.counts[s]} ${s}`);
			if (!rep.errors.length) console.log(`${ok("✓")} ${dec.dir}/: ${rep.total} decisión(es) sin errores${parts.length ? ` (${parts.join(", ")})` : ""}`);
			else process.exitCode = 1;
			return;
		}
	}
}
