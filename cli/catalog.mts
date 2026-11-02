// `bond catalog`: catálogos de skills, comandos y servidores MCP. El de bond va en `catalog/`;
// un equipo crea el suyo en un repo con `bond catalog create` y lo valida con `bond catalog check`.
//
// Estructura (la misma para todos):
//   catalog.toml               name y, por skill, summary/default para bond init
//   skills/<nombre>/SKILL.md   frontmatter name (= carpeta) y description
//   commands/<nombre>.md       frontmatter description; $ARGUMENTS, $1...
//   mcps/<nombre>.json         command/args/env o url/headers, y description
// Los README.md de cada carpeta son documentación: no cuentan como skill, comando ni MCP.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { inspect } from "node:util";
import { parse } from "smol-toml";
import { cleanCache, ensureFetched, gitKey, isGitUrl, type Lock, readLock, repoRelative, resolveRef, writeLock } from "./catalog-git.mts";
import { t } from "./messages.mts";
import { assetsPath } from "./runtime.mts";
import { bad, caution, die, dim, isDryRun, log, ok, run, warn } from "./util.mts";

export const catalogHelp = (): string => t("catalog.help");
export const CATALOG_HELP = catalogHelp;

export interface McpServer {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	description?: string;
}

const README = "README.md";
const NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** Servidores MCP de un catálogo: mcps/<nombre>.json, por nombre. */
export function readMcps(dir: string): Record<string, McpServer> {
	const mcps = join(dir, "mcps");
	if (!existsSync(mcps)) return {};
	return Object.fromEntries(
		readdirSync(mcps)
			.filter((f) => f.endsWith(".json"))
			.sort()
			.map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(mcps, f), "utf8")) as McpServer]),
	);
}

/** Comandos de un catálogo: commands/<nombre>.md, por nombre (sin el README). */
export function readCommandNames(dir: string): string[] {
	const commands = join(dir, "commands");
	if (!existsSync(commands)) return [];
	return readdirSync(commands)
		.filter((f) => f.endsWith(".md") && f !== README)
		.map((f) => f.slice(0, -3))
		.sort();
}

/** Campos del frontmatter YAML de un Markdown, solo los de una línea o en bloque (`>`, `|`). */
export function frontmatter(md: string): Record<string, string> | undefined {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
	if (!m) return undefined;
	const out: Record<string, string> = {};
	const lines = m[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
		if (!kv) continue;
		let value = kv[2].trim();
		if (/^[>|][+-]?$/.test(value)) {
			const block: string[] = [];
			while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
			value = block.join(" ");
		}
		out[kv[1]] = value.replace(/^(["'])(.*)\1$/, "$2");
	}
	return out;
}

/**
 * Validación YAML estricta del frontmatter de una skill. `frontmatter()` es tolerante y
 * saca los campos pase lo que pase; esto comprueba que el bloque es YAML de verdad, porque
 * pi rechaza cargar una skill con frontmatter inválido (Claude Code lo tolera). Un valor
 * plano sin comillas no puede contener `: ` ni terminar en `:` (p. ej. `Agent: and
 * Decision:` dentro de una description), y no hay continuaciones multilínea fuera de los
 * bloques escalares `|` / `>`. Devuelve los errores encontrados (vacío si todo vale).
 */
export function strictFrontmatter(md: string): string[] {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
	if (!m) return [t("catalog.fm_missing")];
	const errors: string[] = [];
	const lines = m[1].split(/\r?\n/);
	let inBlock = false;
	let blockIndent = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const n = i + 2; // línea 1 del fichero es el `---` de apertura
		if (!line.trim()) {
			inBlock = false;
			continue;
		}
		const indent = /^ */.exec(line)![0].length;
		if (inBlock && indent > blockIndent) continue; // contenido literal del bloque escalar
		inBlock = false;
		if (/^\s*#/.test(line)) continue;
		const kv = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
		if (!kv) {
			errors.push(t("catalog.fm_not_kv", { n }));
			continue;
		}
		const v = kv[2].trim();
		if (v === "") continue; // valor vacío: nulo o bloque que sigue
		if (/^[|>][+-]?\d*$/.test(v)) {
			inBlock = true;
			blockIndent = indent;
			continue;
		}
		if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) || (v.startsWith("'") && v.endsWith("'") && v.length > 1)) continue;
		if (v.startsWith('"') || v.startsWith("'")) {
			errors.push(t("catalog.fm_unclosed_quote", { n, key: kv[1] }));
			continue;
		}
		if (v.includes(": ") || v.endsWith(":")) errors.push(t("catalog.fm_unquoted_colon", { n, key: kv[1] }));
	}
	return errors;
}

export interface CatalogReport {
	name?: string;
	skills: string[];
	commands: string[];
	mcps: string[];
	errors: string[];
	warnings: string[];
}

/** Un valor de env/headers que parece un secreto escrito tal cual (y no una ${VARIABLE}). */
const looksSecret = (key: string, value: unknown) =>
	typeof value === "string" && value.trim() !== "" && !value.includes("${") && /key|token|secret|pass|auth|cookie/i.test(key);

/** Comprueba un catálogo. Los errores impiden usarlo; los avisos, no. */
export function validateCatalog(dir: string): CatalogReport {
	const r: CatalogReport = { skills: [], commands: [], mcps: [], errors: [], warnings: [] };
	const err = (s: string) => r.errors.push(s);

	let meta: Record<string, unknown> = {};
	const toml = join(dir, "catalog.toml");
	if (!existsSync(toml)) err(t("catalog.check_missing_toml"));
	else {
		try {
			meta = parse(readFileSync(toml, "utf8")) as Record<string, unknown>;
		} catch (e) {
			err(t("catalog.check_invalid_toml", { err: (e as Error).message.split("\n")[0] }));
		}
	}
	if (meta.name !== undefined) {
		if (typeof meta.name !== "string" || !NAME.test(meta.name)) err(t("catalog.check_invalid_name", { name: JSON.stringify(meta.name) }));
		else r.name = meta.name;
	}

	const skillsDir = join(dir, "skills");
	if (existsSync(skillsDir)) {
		for (const d of readdirSync(skillsDir).sort()) {
			if (d.startsWith(".") || !statSync(join(skillsDir, d)).isDirectory()) continue;
			const file = join(skillsDir, d, "SKILL.md");
			if (!existsSync(file)) {
				err(t("catalog.check_missing_skill_md", { dir: d }));
				continue;
			}
			r.skills.push(d);
			const text = readFileSync(file, "utf8");
			const fm = frontmatter(text);
			if (!fm) err(t("catalog.check_missing_fm", { dir: d }));
			else {
				if (fm.name !== d) err(t("catalog.check_skill_name_mismatch", { dir: d, name: fm.name ? `"${fm.name}"` : t("catalog.check_name_empty") }));
				if (!fm.description) err(t("catalog.check_missing_skill_desc", { dir: d }));
				// YAML estricto: con frontmatter inválido pi no carga la skill (Claude Code lo tolera).
				for (const e of strictFrontmatter(text)) err(t("catalog.check_invalid_fm", { dir: d, err: e }));
			}
			if (!NAME.test(d)) err(t("catalog.check_invalid_skill_name", { dir: d }));
		}
	}
	const entries = meta.skills;
	if (entries !== undefined && (typeof entries !== "object" || entries === null)) err(t("catalog.check_skills_not_table"));
	else {
		for (const [n, e] of Object.entries((entries ?? {}) as Record<string, unknown>)) {
			if (!r.skills.includes(n)) err(t("catalog.check_skills_orphan", { name: n }));
			const entry = (e ?? {}) as Record<string, unknown>;
			if (entry.summary !== undefined && typeof entry.summary !== "string") err(t("catalog.check_skills_summary_not_string", { name: n }));
			if (entry.default !== undefined && typeof entry.default !== "boolean") err(t("catalog.check_skills_default_not_bool", { name: n }));
		}
	}

	for (const n of readCommandNames(dir)) {
		r.commands.push(n);
		if (!NAME.test(n)) err(t("catalog.check_invalid_cmd_name", { name: n }));
		const fm = frontmatter(readFileSync(join(dir, "commands", `${n}.md`), "utf8"));
		if (!fm?.description) err(t("catalog.check_missing_cmd_desc", { name: n }));
	}

	const mcpsDir = join(dir, "mcps");
	if (existsSync(mcpsDir)) {
		for (const f of readdirSync(mcpsDir).filter((f) => f.endsWith(".json")).sort()) {
			const n = f.slice(0, -5);
			const where = `mcps/${f}`;
			let s: unknown;
			try {
				s = JSON.parse(readFileSync(join(mcpsDir, f), "utf8"));
			} catch (e) {
				err(t("catalog.check_mcp_invalid_json", { where, err: (e as Error).message }));
				continue;
			}
			if (typeof s !== "object" || s === null || Array.isArray(s)) {
				err(t("catalog.check_mcp_not_object", { where }));
				continue;
			}
			r.mcps.push(n);
			if (!NAME.test(n)) err(t("catalog.check_mcp_invalid_name", { where }));
			const o = s as Record<string, unknown>;
			const isText = (v: unknown) => typeof v === "string" && v.trim() !== "";
			if (!isText(o.command) && !isText(o.url)) err(t("catalog.check_mcp_needs_cmd_or_url", { where }));
			if (isText(o.command) && isText(o.url)) err(t("catalog.check_mcp_cmd_and_url", { where }));
			if (o.args !== undefined && !(Array.isArray(o.args) && o.args.every((a) => typeof a === "string"))) err(t("catalog.check_mcp_args_not_list", { where }));
			for (const k of ["env", "headers"] as const) {
				const v = o[k];
				if (v === undefined) continue;
				if (typeof v !== "object" || v === null || Array.isArray(v) || !Object.values(v).every((x) => typeof x === "string")) {
					err(t("catalog.check_mcp_field_not_object", { where, field: k }));
					continue;
				}
				for (const [key, value] of Object.entries(v)) {
					if (looksSecret(key, value)) r.warnings.push(t("catalog.check_mcp_looks_secret", { where, field: k, key }));
				}
			}
			if (o.description === undefined) r.warnings.push(t("catalog.check_mcp_missing_desc", { where }));
			else if (typeof o.description !== "string") err(t("catalog.check_mcp_desc_not_string", { where }));
		}
	}
	return r;
}

/** Raíz del repo actual (o el directorio actual, fuera de git). */
function currentRoot(): string {
	const r = run("git", ["rev-parse", "--show-toplevel"]);
	// En Windows git responde C:/x/y: resolve() lo deja con las barras del sistema.
	return r.status === 0 ? resolve(r.stdout.trim()) : process.cwd();
}

/** Nombre de catálogo a partir del de una carpeta: minúsculas, dígitos, - y _. */
export const catalogSlug = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^[-_]+|-+$/g, "") || "catalogo";

const templateDir = () => assetsPath("templates", "catalog");

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

/**
 * Lo que le falta a `root` para ser un catálogo: rutas (con /) y contenido. Si ya hay
 * catalog.toml no se toca; los README.md que existan, tampoco.
 */
export function catalogScaffold(root: string, name: string): Array<{ path: string; content: string }> {
	return walk(templateDir())
		.map((f) => relative(templateDir(), f).split("\\").join("/"))
		.sort()
		.filter((rel) => !existsSync(join(root, rel)))
		.map((rel) => {
			const content = readFileSync(join(templateDir(), rel), "utf8");
			return { path: rel, content: rel === "catalog.toml" ? content.replace("{{name}}", name) : content };
		});
}

async function create(args: string[]): Promise<void> {
	let name: string | undefined;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--name") {
			name = args[++i];
			if (name === undefined) die(t("catalog.create_name_needs_val"));
		} else if (args[i] !== "--dry-run") die(t("catalog.unknown_opt", { opt: args[i] }));
	}
	if (name !== undefined && !NAME.test(name)) die(t("catalog.create_invalid_name", { name }));

	const root = currentRoot();
	if (run("git", ["rev-parse", "--show-toplevel"]).status !== 0) warn(t("catalog.create_not_git", { root }));
	const toml = join(root, "catalog.toml");
	if (existsSync(toml)) {
		// Ya es un catálogo: su nombre manda y no se pregunta.
		if (name !== undefined) warn(t("catalog.create_toml_exists"));
		name = validateCatalog(root).name ?? catalogSlug(basename(root));
	} else if (name === undefined) {
		const suggested = catalogSlug(basename(root));
		if (process.stdin.isTTY === true) {
			const p = await import("@clack/prompts");
			const answer = await p.text({
				message: t("catalog.create_prompt_name"),
				initialValue: suggested,
				validate: (v) => (NAME.test(v ?? "") ? undefined : t("catalog.create_prompt_validate")),
			});
			if (typeof answer !== "string") die(t("catalog.cancelled"), 130);
			name = answer;
		} else name = suggested;
	}

	log(t("catalog.create_start", { root }));
	const missing = catalogScaffold(root, name);
	if (!missing.length) {
		console.log(dim(t("catalog.create_already_complete")));
		return;
	}
	for (const f of missing) {
		if (isDryRun()) {
			console.log(dim(t("catalog.create_dry_run", { path: f.path })));
			continue;
		}
		mkdirSync(dirname(join(root, f.path)), { recursive: true });
		writeFileSync(join(root, f.path), f.content);
		console.log(`${ok("+")} ${f.path}`);
	}
	if (isDryRun()) return;
	console.log(t("catalog.create_summary", { name }));
}

/** "1 skill", "2 skills". */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function check(args: string[]): void {
	const dirs = args.filter((a) => !a.startsWith("-"));
	for (const a of args) if (a.startsWith("-") && a !== "--dry-run") die(t("catalog.unknown_opt", { opt: a }));
	if (dirs.length > 1) die(t("catalog.check_one_dir"));
	const dir = dirs[0] ? resolve(dirs[0]) : currentRoot();
	if (!existsSync(dir) || !statSync(dir).isDirectory()) die(t("catalog.check_dir_not_found", { dir }));
	const r = validateCatalog(dir);
	for (const w of r.warnings) warn(w);
	for (const e of r.errors) console.error(`${bad(t("catalog.error_prefix"))} ${e}`);
	const label = r.name ? `"${r.name}"` : (relative(process.cwd(), dir) || ".");
	const counts = `${count(r.skills.length, t("catalog.count_skill_one"), t("catalog.count_skill_many"))}, ${count(r.commands.length, t("catalog.count_cmd_one"), t("catalog.count_cmd_many"))}, ${count(r.mcps.length, t("catalog.count_mcp_one"), t("catalog.count_mcp_many"))}`;
	if (r.errors.length) die(t("catalog.check_failed", { label, errors: count(r.errors.length, t("catalog.count_error_one"), t("catalog.count_error_many")), counts }));
	const warnSuffix = r.warnings.length ? t("catalog.check_warnings_suffix", { count: count(r.warnings.length, t("catalog.count_warning_one"), t("catalog.count_warning_many")) }) : "";
	console.log(`${ok("✓")} ` + t("catalog.check_ok", { label, counts, warnings: warnSuffix }));
}

// --- catálogos del equipo en un repo: add, list, update, remove, clean --------------------

/** Bloques [[catalog]] de un bond.toml, en orden: dónde empieza y acaba cada uno (en caracteres). */
function catalogBlocks(text: string): Array<{ start: number; end: number }> {
	const blocks: Array<{ start: number; end: number }> = [];
	let offset = 0;
	let open: number | undefined;
	for (const line of text.split(/(?<=\n)/)) {
		if (/^\s*\[/.test(line)) {
			if (open !== undefined) blocks.push({ start: open, end: offset });
			open = /^\s*\[\[catalog\]\]\s*(#.*)?$/.test(line.trimEnd()) ? offset : undefined;
		}
		offset += line.length;
	}
	if (open !== undefined) blocks.push({ start: open, end: text.length });
	return blocks;
}

/** Añade un [[catalog]] al final de bond.toml. */
function appendCatalog(text: string, fields: Array<[string, string]>): string {
	return `${text.replace(/\s*$/, "")}\n\n[[catalog]]\n${fields.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("\n")}\n`;
}

/** Quita el [[catalog]] nº i (desde 0). */
function removeCatalogBlock(text: string, i: number): string {
	const b = catalogBlocks(text)[i];
	return `${(text.slice(0, b.start).replace(/\s*$/, "\n") + text.slice(b.end).replace(/^\s*/, "\n")).replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s*$/, "")}\n`;
}

/** Pone (o quita, con undefined) una clave dentro del [[catalog]] nº i. */
function setInCatalog(text: string, i: number, key: string, value: string | undefined): string {
	const b = catalogBlocks(text)[i];
	let block = text.slice(b.start, b.end);
	const re = new RegExp(`^${key}\\s*=.*\\n?`, "m");
	const line = value === undefined ? "" : `${key} = ${JSON.stringify(value)}\n`;
	block = re.test(block) ? block.replace(re, line) : block.replace(/^(.*\n)/, `$1${line}`);
	return text.slice(0, b.start) + block + text.slice(b.end);
}

type Repo = typeof import("./repo.mts");

/** Raíz, bond.toml (texto y TOML) y lock de un repo con bond. */
async function repoState() {
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const file = join(root, ".bond", "bond.toml");
	if (!existsSync(file)) die(t("catalog.no_bond_toml"));
	const toml = readFileSync(file, "utf8");
	let raw: Record<string, unknown>;
	try {
		raw = parse(toml) as Record<string, unknown>;
	} catch (e) {
		die(t("catalog.invalid_bond_toml", { err: (e as Error).message }));
	}
	const decl = (Array.isArray(raw.catalog) ? raw.catalog : []) as Array<Record<string, unknown>>;
	return { repo, root, file, toml, decl, lock: readLock(root) };
}

/** Una línea de servidor MCP para revisar: qué ejecuta o adónde se conecta. */
const mcpLine = (s: McpServer) => (s.url ? s.url : [s.command, ...(s.args ?? [])].join(" ")) + (s.env ? `  env: ${Object.keys(s.env).join(", ")}` : "");

/** Servidores MCP que trae o cambia un catálogo: ejecutan programas, así que se revisan (D4). */
function mcpReview(name: string, oldDir: string | undefined, newDir: string): string[] {
	const lines: string[] = [];
	const prev = oldDir ? readMcps(oldDir) : {};
	const next = readMcps(newDir);
	for (const [n, s] of Object.entries(next)) {
		if (!prev[n]) lines.push(`  ${ok("+")} mcp ${n}: ${mcpLine(s)}`);
		else if (JSON.stringify({ ...prev[n], description: undefined }) !== JSON.stringify({ ...s, description: undefined })) lines.push(`  ${bad("~")} mcp ${n}: ${mcpLine(prev[n])}  →  ${mcpLine(s)}`);
	}
	for (const n of Object.keys(prev)) if (!next[n]) lines.push(`  ${bad("-")} mcp ${n}`);
	if (lines.length) lines.unshift(t("catalog.mcp_review_header", { name }));
	return lines;
}

type RepoConfig = import("./repo.mts").RepoConfig;

/** Lo que usa el repo y pasa a venir de otro catálogo (p. ej. una skill de bond que sustituye la del equipo). */
function movedReview(before: RepoConfig | undefined, after: RepoConfig): string[] {
	if (!before) return [];
	const moved: string[] = [];
	for (const kind of ["mcp", "skills", "commands"] as const) {
		after.tools[kind].forEach((tool, i) => {
			const was = before.tools[kind][i];
			if (was && was.name === tool.name && was.catalog.name !== tool.catalog.name) moved.push(t("catalog.moved_item", { symbol: caution("~"), name: tool.name, from: was.catalog.name, to: tool.catalog.name }));
		});
	}
	return moved.length ? [t("catalog.moved_header"), ...moved] : [];
}

/** Enseña lo que hay que revisar y pide confirmación (o --yes). Devuelve si se sigue. */
async function confirm(lines: string[], yes: boolean): Promise<boolean> {
	if (!lines.length) return true;
	console.log(lines.join("\n"));
	if (yes) return true;
	if (process.stdin.isTTY !== true) die(t("catalog.confirm_changes_unattended"));
	const p = await import("@clack/prompts");
	const answer = await p.confirm({ message: t("catalog.confirm_prompt"), initialValue: false });
	return answer === true;
}

function flags(args: string[], withValue: string[], bare: string[]): { opts: Record<string, string>; has: Set<string>; pos: string[] } {
	const opts: Record<string, string> = {};
	const has = new Set<string>();
	const pos: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (withValue.includes(a)) {
			if (args[i + 1] === undefined) die(t("catalog.flag_needs_value", { flag: a }));
			opts[a] = args[++i];
		} else if (bare.includes(a)) has.add(a);
		else if (a.startsWith("-")) die(t("catalog.unknown_opt", { opt: a }));
		else pos.push(a);
	}
	return { opts, has, pos };
}

async function add(args: string[]): Promise<void> {
	const { opts, has, pos } = flags(args, ["--name", "--ref"], ["--yes", "-y"]);
	if (pos.length !== 1) die(t("catalog.add_usage"));
	const source = pos[0];
	const { repo, root, file, toml, lock } = await repoState();
	const before = repo.loadRepoConfig(root);
	let dir: string;
	let fields: Array<[string, string]>;
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	if (isGitUrl(source)) {
		const twin = before.catalogs.find((c) => c.git && gitKey(c.git) === gitKey(source));
		if (twin) die(t("catalog.add_already_exists", { source, name: twin.name }));
		const sha = resolveRef(source, opts["--ref"]);
		dir = ensureFetched(source, sha);
		const name = opts["--name"] ?? validateCatalog(dir).name ?? catalogSlug(basename(gitKey(source)));
		fields = [["name", name], ["git", source], ...(opts["--ref"] ? [["ref", opts["--ref"]] as [string, string]] : [])];
		nextLock.catalogs[name] = { git: source, ...(opts["--ref"] ? { ref: opts["--ref"] } : {}), sha };
	} else {
		if (opts["--ref"]) die(t("catalog.add_ref_only_git"));
		dir = resolve(source);
		if (!existsSync(dir) || !statSync(dir).isDirectory()) die(t("catalog.add_folder_not_found", { source }));
		const path = repoRelative(root, dir);
		fields = [...(opts["--name"] ? [["name", opts["--name"]] as [string, string]] : []), ["path", path]];
	}
	// Se valida todo lo que quedaría (catálogo, nombres, lo que pide el repo) antes de escribir.
	const report = validateCatalog(dir);
	if (report.errors.length) {
		for (const e of report.errors) console.error(`${bad(t("catalog.error_prefix"))} ${e}`);
		die(t("catalog.add_has_errors", { source, errors: count(report.errors.length, t("catalog.count_error_one"), t("catalog.count_error_many")) }));
	}
	const nextToml = appendCatalog(toml, fields);
	const after = repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	const added = after.catalogs[after.catalogs.length - 1];
	if (!(await confirm([...mcpReview(added.name, undefined, added.dir), ...movedReview(before, after)], has.has("--yes") || has.has("-y")))) die(t("catalog.add_cancelled"), 130);
	writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	const counts = {
		skills: count(report.skills.length, t("catalog.count_skill_one"), t("catalog.count_skill_many")),
		commands: count(report.commands.length, t("catalog.count_cmd_one"), t("catalog.count_cmd_many")),
		mcps: count(report.mcps.length, t("catalog.count_mcp_one"), t("catalog.count_mcp_many")),
	};
	console.log(`${ok("+")} ` + t("catalog.add_success", { name: added.name, where: repo.catalogWhere(added), ...counts }));
	repo.syncRepo();
	console.log(dim(t("catalog.add_next_hint")));
}

async function list(args: string[]): Promise<void> {
	flags(args, [], []);
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const catalogs = existsSync(join(root, ".bond", "bond.toml")) ? repo.loadRepoConfig(root).catalogs : [];
	const width = Math.max(14, ...catalogs.map((c) => c.name.length + 2));
	console.log(`  ${"bond".padEnd(width)}${dim(t("catalog.list_bond_builtin"))}`);
	for (const c of catalogs.slice(1)) {
		console.log(`  ${c.name.padEnd(width)}${c.git ? `${c.git}  ${dim(`${c.ref ?? t("catalog.default_branch")} @ ${c.sha?.slice(0, 7)}`)}` : `${c.path}  ${dim(t("catalog.list_folder"))}`}`);
	}
}

async function update(args: string[]): Promise<void> {
	const { opts, has, pos } = flags(args, ["--ref"], ["--yes", "-y"]);
	if (pos.length > 1) die(t("catalog.update_usage"));
	const { repo, root, file, toml, decl, lock } = await repoState();
	const gits = decl.map((e, i) => ({ e, i })).filter(({ e }) => typeof e.git === "string");
	const targets = pos[0] ? gits.filter(({ e }) => e.name === pos[0]) : gits;
	if (pos[0] && !targets.length) die(decl.some((e) => e.name === pos[0]) ? t("catalog.update_local_catalog", { name: pos[0] }) : t("catalog.update_not_found", { name: pos[0] }));
	if (!targets.length) return console.log(dim(t("catalog.update_none_git")));
	if (opts["--ref"] && targets.length > 1) die(t("catalog.update_ref_needs_name"));
	// Con el lock al día se puede comparar con lo de antes; si no (falta o es de otra URL), no.
	const fresh = gits.every(({ e }) => {
		const l = lock.catalogs[e.name as string];
		return l && gitKey(l.git) === gitKey(e.git as string) && (l.ref ?? "") === ((e.ref as string | undefined) ?? "");
	});
	const before = fresh ? repo.loadRepoConfig(root) : undefined;
	let nextToml = toml;
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	const changed: Array<{ name: string; oldDir?: string }> = [];
	for (const { e, i } of targets) {
		const name = e.name as string;
		const url = e.git as string;
		const ref = opts["--ref"] ?? (e.ref as string | undefined);
		const sha = resolveRef(url, ref);
		const old = lock.catalogs[name];
		if (old && old.sha === sha && gitKey(old.git) === gitKey(url) && (old.ref ?? "") === (ref ?? "")) {
			console.log(`${dim("=")} ` + t("catalog.update_up_to_date", { name, ref: ref ?? t("catalog.default_branch"), sha: sha.slice(0, 7) }));
			continue;
		}
		ensureFetched(url, sha);
		if (opts["--ref"]) nextToml = setInCatalog(nextToml, i, "ref", opts["--ref"]);
		nextLock.catalogs[name] = { git: url, ...(ref ? { ref } : {}), sha };
		changed.push({ name, oldDir: old && gitKey(old.git) === gitKey(url) ? ensureFetched(old.git, old.sha) : undefined });
		const oldSha = old ? old.sha.slice(0, 7) : t("catalog.unpinned");
		console.log(`${caution("~")} ` + t("catalog.update_changed", { name, old: oldSha, new: sha.slice(0, 7), ref: ref ?? t("catalog.default_branch") }));
	}
	if (!changed.length) return;
	const after = repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	const lines = [...changed.flatMap((c) => mcpReview(c.name, c.oldDir, after.catalogs.find((x) => x.name === c.name)!.dir)), ...movedReview(before, after)];
	if (!(await confirm(lines, has.has("--yes") || has.has("-y")))) die(t("catalog.update_cancelled"), 130);
	if (nextToml !== toml) writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	repo.syncRepo();
}

async function remove(args: string[]): Promise<void> {
	const { pos } = flags(args, [], []);
	if (pos.length !== 1) die(t("catalog.remove_usage"));
	const name = pos[0];
	const { repo, root, file, toml, decl, lock } = await repoState();
	// Por su name, o por el que tiene su catalog.toml (los locales pueden no llevarlo en bond.toml).
	const i = decl.findIndex((e) => e.name === name || (e.name === undefined && typeof e.path === "string" && existsSync(resolve(root, e.path)) && (validateCatalog(resolve(root, e.path)).name ?? catalogSlug(basename(resolve(root, e.path)))) === name));
	if (i < 0) die(t("catalog.remove_not_found", { name }));
	let nextToml = removeCatalogBlock(toml, i);
	const nextLock: Lock = { catalogs: { ...lock.catalogs } };
	delete nextLock.catalogs[name];
	// Lo que el repo pedía de ese catálogo deja de existir: se quita de la selección.
	const known = repo.availableRefs(root, nextToml, nextLock);
	const raw = parse(nextToml) as Record<string, unknown>;
	const sel = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : []);
	const dropped: string[] = [];
	const keep = (k: "mcp" | "skills" | "commands") =>
		sel(k).filter((r) => {
			const found = known[k].has(r);
			if (!found) dropped.push(r);
			return found;
		});
	const kept = { mcp: keep("mcp"), skills: keep("skills"), commands: keep("commands") };
	if (dropped.length) nextToml = repo.updateBondToml(nextToml, { agents: sel("agents"), default_agent: typeof raw.default_agent === "string" ? raw.default_agent : undefined, ...kept });
	repo.loadRepoConfig(root, { toml: nextToml, lock: nextLock });
	writeFileSync(file, nextToml);
	writeLock(root, nextLock);
	const droppedStr = dropped.length ? dim(t("catalog.remove_dropped", { dropped: dropped.join(", ") })) : "";
	console.log(`${bad("-")} ` + t("catalog.remove_success", { name, dropped: droppedStr }));
	repo.syncRepo();
}

async function clean(args: string[]): Promise<void> {
	flags(args, [], []);
	const repo: Repo = await import("./repo.mts");
	const root = repo.repoRoot();
	const keep = Object.values(readLock(root).catalogs);
	const n = cleanCache(keep);
	const nStr = count(n, t("catalog.count_commit_del_one"), t("catalog.count_commit_del_many"));
	const keptStr = keep.length ? dim(keep.length === 1 ? t("catalog.clean_kept_one") : t("catalog.clean_kept_many", { count: keep.length })) : "";
	console.log(`${n ? ok("-") : dim("=")} ` + t("catalog.clean_summary", { count: nStr, kept: keptStr }));
}

export async function catalogCommand(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "create") return create(rest);
	if (sub === "check") return check(rest);
	if (sub === "add") return add(rest);
	if (sub === "list") return list(rest);
	if (sub === "update") return update(rest);
	if (sub === "remove") return remove(rest);
	if (sub === "clean") return clean(rest);
	if (sub) die(t("catalog.unknown_sub", { sub }));
	console.log(catalogHelp());
	process.exit(2);
}
