// `bond decisions`: la memoria de decisiones del repo (sección [decisions] de
// .bond/bond.toml). Los agentes registran con `add` (o la herramienta `record_decision`
// de pi, que llama a este mismo código): bond calcula el id, la autoría (D12), escribe
// el fichero con el formato de D6 y la fila del índice. Aceptar es solo del usuario:
// `accept` exige terminal interactiva y confirmación (D13). `check` audita los registros
// para que la memoria no se rompa con el uso.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { agents } from "./herdr.mts";
import { decisionsReadme, repoDecisions, repoRoot } from "./repo.mts";
import { bad, catchDie, die, dim, ok, run } from "./util.mts";

export const STATUSES = ["proposed", "accepted", "rejected", "superseded"];

export const DECISIONS_HELP = `Uso: bond decisions [subcomando] [opciones]

La memoria de decisiones del repo ([decisions] en .bond/bond.toml). Sin subcomando,
lista las decisiones.

  (lista) [--status <s>] [--agent <a>] [--json]
            Decisiones del repo, las más recientes primero.
  add --title <t> [--context <c>] --decision <d> [--alternatives <a>]
      [--consequences <c>] [--link <ref>]... [--json]
            Registra una decisión: bond calcula el id (YYYY-MM-DD-slug), la autoría
            (desde el panel de Herdr, agent:<kind>/<nombre>; fuera, user) y la añade
            al índice. Siempre entra como "proposed". El cuerpo queda con los apartados
            en inglés: Context / Decision / Rejected alternatives / Consequences
            (este solo si pasas --consequences). Con --stdin, el mismo objeto en JSON
            por la entrada estándar: {"title","context","decision","alternatives",
            "consequences","links"}.
  accept <id> [--ref <aceptación>]
            La pasa a "accepted". Necesita terminal interactiva y tu confirmación:
            desde el shell de un agente (sin TTY) se niega. La barrera de TTY evita
            aceptaciones por descuido de un agente; no es una medida de seguridad.
  reject <id> [--ref <motivo>]     La pasa a "rejected" (misma confirmación).
  supersede <id> --by <nueva>     La sustituye: la vieja queda "superseded" y la
                                  nueva la referencia en "supersedes".
  show <id>                       El fichero entero de la decisión.
  runs [--agent <a>] [--json]     Los runs (encargos a agentes) de <dir>/runs/.
  check                           Audita la memoria: frontmatter, ids, duplicados,
                                  sustituciones, trailers Decision: e índice. Sale
                                  con 1 si hay errores.

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
 * listas (`links:` con items `- "x"`, o inline `[]`). Devuelve undefined si el texto no
 * arranca con `---` o no cierra.
 */
export function parseFm(text: string): Parsed | undefined {
	const lines = text.split("\n");
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
		if (raw === "" && key === "links") { listKey = key; lists[key] = []; continue; }
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
	supersedes: p.scalars.supersedes ?? "",
	superseded_by: p.scalars.superseded_by ?? "",
	links: p.lists.links ?? [],
	body: p.body,
});

function decisionFile(d: Decision): string {
	const links = d.links.length ? `links:\n${d.links.map((l) => `  - ${q(l)}`).join("\n")}` : "links: []";
	return `---\nid: ${q(d.id)}\ntitle: ${q(d.title)}\nstatus: ${q(d.status)}\ndate: ${q(d.date)}\ndecided_by: ${q(d.decided_by)}\naccepted_by: ${q(d.accepted_by)}\nsupersedes: ${q(d.supersedes)}\nsuperseded_by: ${q(d.superseded_by)}\n${links}\n---\n${d.body}`;
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
}

const section = (name: string, text?: string) => (text && text.trim() ? `\n## ${name}\n\n${text.trim()}\n` : "");

function buildBody(in_: AddInput): string {
	return section("Context", in_.context) + section("Decision", in_.decision) + section("Rejected alternatives", in_.alternatives) + section("Consequences", in_.consequences);
}

/** Registra una decisión: fichero con el formato de D6 + fila en el índice. */
export function addDecision(root: string, dirRel: string, in_: AddInput): { id: string; rel: string; decided_by: string } {
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
	const d: Decision = {
		id,
		title,
		status: "proposed",
		date: utcToday(),
		decided_by,
		accepted_by: "",
		supersedes: "",
		superseded_by: "",
		links: [...(in_.links ?? []).map((l) => l.trim()).filter(Boolean), ...gitLinks(root)],
		body: `\n${buildBody(in_)}`,
		rel: `${dirRel}/${id}.md`,
	};
	writeFileSync(join(dir, `${id}.md`), decisionFile(d));
	upsertIndex(root, dirRel, d);
	return { id, rel: `${dirRel}/${id}.md`, decided_by };
}

// --- índice -------------------------------------------------------------------------------

const cell = (s: string) => s.replaceAll("|", "\\|");
const indexRow = (d: Decision) => `| ${d.id} | ${d.status} | ${cell(d.decided_by)} | ${d.date} | ${cell(d.title)} |`;

interface IndexTable {
	header: number;
	sep: number;
	rows: Array<{ line: number; id: string; status: string }>;
}

/** La tabla del índice del README: cabecera `| ID | ... |`, separador y filas. */
function findIndex(lines: string[]): IndexTable | undefined {
	const header = lines.findIndex((l) => /^\|\s*ID\s*\|/i.test(l));
	if (header < 0 || header + 1 >= lines.length || !/^\|[\s:-]+\|/.test(lines[header + 1])) return undefined;
	const rows: IndexTable["rows"] = [];
	for (let i = header + 2; i < lines.length && /^\|/.test(lines[i]); i++) {
		const cols = lines[i].split("|").map((c) => c.trim());
		const id = (cols[1] ?? "").replace(/^`|`$/g, "");
		if (id) rows.push({ line: i, id, status: cols[2] ?? "" });
	}
	return { header, sep: header + 1, rows };
}

/** Inserta (o reemplaza si ya estaba) la fila de una decisión bajo la cabecera del índice. */
function upsertIndex(root: string, dirRel: string, d: Decision): void {
	const readme = join(dirAbs(root, dirRel), "README.md");
	if (!existsSync(readme)) writeFileSync(readme, decisionsReadme());
	const lines = readFileSync(readme, "utf8").split("\n");
	const t = findIndex(lines);
	if (!t) return; // índice sin tabla: no lo tocamos, cada repo es libre de editarlo
	const row = indexRow(d);
	const existing = t.rows.find((r) => r.id === d.id);
	if (existing) lines[existing.line] = row;
	else lines.splice(t.sep + 1, 0, row);
	writeFileSync(readme, lines.join("\n"));
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

/** D13: aceptar, rechazar o sustituir solo con terminal interactiva y confirmación. */
function requireTty(what: string): void {
	if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
		die(`${what} la hace solo el usuario, y necesita una terminal interactiva: desde el shell de un agente no se puede. Registra la decisión como "proposed" y acéptala tú con bond decisions ${what} <id>`);
	}
}

/** Pide confirmación al usuario antes de cambiar el estado. Con otra respuesta, no lo hace. */
async function confirmChange(verb: string, id: string): Promise<void> {
	if (!(await confirm(`¿${verb} la decisión ${id}? [y/N] `))) {
		console.log(dim("cancelado: nada cambió."));
		process.exit(0);
	}
}

/** Reescribe una decisión cambiando estado y (si se da) accepted_by, y refresca el índice. */
function patchDecision(root: string, dirRel: string, id: string, patch: Partial<Pick<Decision, "status" | "accepted_by" | "supersedes" | "superseded_by">>): Decision {
	const f = findDecisionFile(root, dirRel, id);
	const p = parseFm(readFileSync(f, "utf8"));
	if (!p) die(`${dirRel}/${id}.md: sin frontmatter válido; arreglalo antes (bond decisions check)`);
	const d = { ...(decisionFields(p) as Omit<Decision, "rel">), rel: `${dirRel}/${id}.md` };
	Object.assign(d, patch);
	writeFileSync(f, decisionFile(d));
	upsertIndex(root, dirRel, d);
	return d;
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
	}
	for (const t of decisionTrailers(root)) {
		if (!byId.has(t)) errors.push(`trailers Decision: apuntan a "${t}", que no existe en ${dirRel}/`);
	}
	// Índice: cada decisión, una fila con el estado del fichero; sin filas huérfanas.
	const readme = join(dir, "README.md");
	if (!existsSync(readme)) errors.push(`${dirRel}/README.md: no existe el índice (bond sync lo crea)`);
	else {
		const t = findIndex(readFileSync(readme, "utf8").split("\n"));
		if (!t) errors.push(`${dirRel}/README.md: no hay tabla de índice (| ID | Estado | ... |)`);
		else {
			const seen = new Map<string, number>();
			for (const r of t.rows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
			for (const [id, { rel }] of byId) {
				const n = seen.get(id) ?? 0;
				if (n === 0) errors.push(`${rel}: sin fila en el índice`);
				else if (n > 1) errors.push(`${rel}: ${n} filas en el índice para la misma decisión`);
				const row = t.rows.find((r) => r.id === id);
				const status = byId.get(id)?.p.scalars.status;
				if (row && status && row.status !== status) errors.push(`${rel}: el índice dice "${row.status}" y el fichero "${status}"`);
			}
			for (const r of t.rows) if (!byId.has(r.id)) errors.push(`${dirRel}/README.md: fila del índice para "${r.id}", que no existe en ${dirRel}/`);
		}
	}
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

const VALUE_OPTS = ["--title", "--context", "--decision", "--alternatives", "--consequences", "--link", "--ref", "--by", "--status", "--agent"];

function parseArgs(args: string[]): Args {
	const pos: string[] = [];
	const opts: Record<string, string> = {};
	const links: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--json" || a === "--stdin") opts[a] = "";
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
	} else {
		input = { title: a.opts["--title"] ?? "", context: a.opts["--context"], decision: a.opts["--decision"] ?? "", alternatives: a.opts["--alternatives"], consequences: a.opts["--consequences"], links: a.links };
	}
	const { id, rel, decided_by } = addDecision(root, dir, input);
	if (a.json) console.log(JSON.stringify({ id, path: rel, status: "proposed", decided_by }));
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
			requireTty("accept");
			const id = a.pos[0] ?? die("uso: bond decisions accept <id> [--ref <aceptación>]");
			await confirmChange("aceptar", id);
			const d = patchDecision(root, dec.dir, id, { status: "accepted", ...(a.opts["--ref"] ? { accepted_by: a.opts["--ref"] } : {}) });
			console.log(`${ok("~")} ${d.rel}  ${dim(`accepted${d.accepted_by ? ` · ${d.accepted_by}` : ""}`)}`);
			return;
		}
		case "reject": {
			requireTty("reject");
			const id = a.pos[0] ?? die("uso: bond decisions reject <id> [--ref <motivo>]");
			await confirmChange("rechazar", id);
			const d = patchDecision(root, dec.dir, id, { status: "rejected", ...(a.opts["--ref"] ? { accepted_by: a.opts["--ref"] } : {}) });
			console.log(`${ok("~")} ${d.rel}  ${dim(`rejected${d.accepted_by ? ` · ${d.accepted_by}` : ""}`)}`);
			return;
		}
		case "supersede": {
			requireTty("supersede");
			const id = a.pos[0] ?? die("uso: bond decisions supersede <id> --by <nueva>");
			const by = a.opts["--by"] ?? die("supersede necesita --by <id de la decisión que la sustituye>");
			findDecisionFile(root, dec.dir, by);
			await confirmChange(`sustituir ${id} por ${by}`, id);
			patchDecision(root, dec.dir, id, { status: "superseded", superseded_by: by });
			patchDecision(root, dec.dir, by, { supersedes: by });
			console.log(`${ok("~")} ${id}  ${dim(`superseded por ${by}`)}`);
			return;
		}
		case "show": {
			const id = a.pos[0] ?? die("uso: bond decisions show <id>");
			const f = findDecisionFile(root, dec.dir, id);
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
			for (const r of filtered) console.log(`${r.file}  ${dim(`${r.fm.scalars.kind ?? "?"}/${r.fm.scalars.agent ?? "?"} · ${r.fm.scalars.branch ?? "?"} · ${r.fm.scalars.status ?? "?"}`)}`);
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
