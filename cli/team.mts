// `bond team`: un agente por rama, cada uno en su worktree, y lo que viene después: ver cómo va
// cada rama (status), mandar trabajo a la de una rama (prompt) y quitar los worktrees que ya no
// hacen falta (clean). Las ramas no se tocan: nada de merge, push ni borrado sin pedirlo.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync, rmdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { chooseAgent, gitRoot, openWorkspace } from "./launch.mts";
import { agents, ensureServer, firstFreeName, herdr, type HerdrAgent, insideHerdr, pendingQuestion, requireHerdr, serverRunning, workspaces } from "./herdr.mts";
import { act, bad, caution, die, dim, isDryRun, ok, run, warn } from "./util.mts";

export const TEAM_HELP = `Uso: bond team [repo] <rama[:agente]>... [opciones] [-- argumentos de los agentes]
       bond team status [repo] [--base <ref>] [--json]
       bond team prompt <rama> <tarea> [--wait] [--timeout <ms>]
       bond team clean [repo] [rama...] [--base <ref>] [--force] [--delete-branch] [--dry-run]

Abre un worktree y un agente por rama. Sin [repo], el repo del directorio actual. El agente de
cada rama: el de rama:agente, si no --agent, si no el agente por defecto del repo
(.bond/bond.toml), si no el de bond setup. Los worktrees salen de lo commiteado.

Dentro de Herdr, cada agente va en un panel de tu pestaña, debajo del tuyo (en fila, 4 como
mucho; los siguientes, debajo), con nombre de minion (kevin, stuart, bob...). Fuera de Herdr o
con --workspaces, un workspace por rama.

  -a, --agent <agente>   Agente para las ramas sin :agente
  -b, --base <ref>       Ref de la que salen las ramas nuevas
  --workspaces           Un workspace por rama (herdr worktree) en vez de paneles
  --trust-repository     Con --workspaces: se pasa a herdr worktree (solo en repos revisados)

status   Cada worktree del repo: estado, agente, commits por delante de la base y ficheros.
         Estados: trabajando, bloqueado, sin commitear, lista (commits por revisar),
         integrada (ya está en la base, también por rebase o squash), sin commits.
         La base, por defecto, es la rama del checkout principal.
prompt   Manda una tarea al agente de esa rama (herdr agent prompt); --wait espera a que acabe.
clean    Quita worktrees (carpeta, workspace y agente); las ramas se quedan. Sin ramas, solo
         los integrados que abrió Herdr. Nunca uno con el agente trabajando o con cambios sin
         commitear, salvo con --force. --delete-branch borra además las ramas integradas.`;

// --- crear el equipo ----------------------------------------------------------------------

export interface TeamArgs {
	dir?: string;
	agent?: string;
	base?: string;
	trust: boolean;
	/** Un workspace por rama (herdr worktree) en vez de paneles en la pestaña. */
	workspaces: boolean;
	specs: Array<{ branch: string; agent?: string }>;
	agentArgs: string[];
}

/**
 * Argumentos de bond team. El primero es el repo solo si es una carpeta que existe; si no, es
 * ya una rama (bond team feat/a feat/b:claude, dentro del repo).
 */
export function parseTeam(args: string[], isDir: (p: string) => boolean = existsSync): TeamArgs {
	const o: TeamArgs = { trust: false, workspaces: false, specs: [], agentArgs: [] };
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(`${a} necesita un valor (bond team --help)`);
		if (a === "-k" || a === "--kind" || a === "-a" || a === "--agent") o.agent = val();
		else if (a === "-b" || a === "--base") o.base = val();
		else if (a === "--trust-repository") o.trust = true;
		else if (a === "--workspaces") o.workspaces = true;
		else if (a === "--") {
			o.agentArgs = args.slice(i + 1);
			break;
		} else if (a.startsWith("-")) die(`opción desconocida: ${a} (bond team --help)`);
		else positional.push(a);
	}
	if (positional.length && isDir(positional[0])) o.dir = positional.shift();
	const seen = new Set<string>();
	for (const spec of positional) {
		const [branch, agent, ...extra] = spec.split(":");
		if (!branch || extra.length || agent === "") die(`rama mal escrita: ${spec} (rama o rama:agente)`);
		if (seen.has(branch)) die(`rama repetida: ${branch}`);
		seen.add(branch);
		o.specs.push({ branch, agent });
	}
	if (!o.specs.length) die("faltan las ramas: bond team [repo] <rama[:agente]>... (bond team --help)", 2);
	return o;
}

const repoOf = (dir?: string) => gitRoot(resolve(dir ?? ".")) ?? die(`no es un repo git: ${resolve(dir ?? ".")}`);

async function create(args: string[]): Promise<void> {
	requireHerdr();
	const o = parseTeam(args);
	const root = repoOf(o.dir);
	// Antes de tocar Herdr: un nombre de rama inválido dejaría un workspace a medias.
	const invalid = o.specs.filter((s) => run("git", ["-C", root, "check-ref-format", "--branch", s.branch]).status !== 0).map((s) => s.branch);
	if (invalid.length) die(`nombre de rama no válido para git: ${invalid.map((b) => JSON.stringify(b)).join(", ")}`);

	// Agentes del repo (bond.toml): el de por defecto, y para avisar de los que no tienen config.
	let repoAgents: string[] | undefined;
	let repoDefault: string | undefined;
	if (existsSync(join(root, ".bond", "bond.toml"))) {
		process.chdir(root);
		const { loadRepoAgents } = await import("./repo.mts");
		({ agents: repoAgents, default_agent: repoDefault } = loadRepoAgents(root));
	}
	const defaultAgent = await chooseAgent(o.agent, repoDefault);
	const plan: Array<{ branch: string; agent: string }> = [];
	for (const s of o.specs) plan.push({ branch: s.branch, agent: s.agent ? await chooseAgent(s.agent, undefined) : defaultAgent });
	const foreign = [...new Set(plan.map((p) => p.agent))].filter((a) => repoAgents && !repoAgents.includes(a));
	if (foreign.length) warn(`${foreign.join(", ")} no está entre los agentes del repo: sin su config (MCP, skills...). Añádelo con bond init`);
	if (run("git", ["-C", root, "status", "--porcelain"]).stdout.trim()) warn("hay cambios sin commitear: los worktrees salen de lo commiteado y no los verán");

	if (!insideHerdr()) await ensureServer();
	const anchor = process.env.HERDR_PANE_ID;
	if (insideHerdr() && anchor && !o.workspaces) {
		openInTab(root, anchor, plan, o);
	} else for (const { branch, agent } of plan) {
		try {
			const r = openWorkspace({ dir: root, agent, worktree: branch, base: o.base, shell: false, direction: "right", ratio: "0.6", focus: false, trust: o.trust, agentArgs: o.agentArgs });
			console.log(`${ok("✓")} ${branch}  ${r.reused ? dim(`ya abierto (${r.ws})`) : `${r.agentName} (${agent}) en ${r.agentPane}${r.blocked ? caution(" · espera una respuesta tuya") : ""}`}`);
		} catch (e) {
			warn(`${branch}: ${(e as Error).message}`);
		}
	}
	const { renderSmall } = await import("../lib/bond-logo.mts");
	console.log(`\n  ${renderSmall(60, `equipo en ${basename(root)}`)}\n`);
	printStatus(teamRows(root, o.base));
	console.log(dim(`\n  Repartir trabajo: bond team prompt <rama> "la tarea"\n  Cómo va: bond team status · Al acabar: bond team clean`));
}

// --- equipo en la pestaña -------------------------------------------------------------------

/** Nombres de los minions, en orden: cada agente de bond team coge el primero libre en Herdr. */
export const MINIONS = ["kevin", "stuart", "bob", "dave", "jerry", "carl", "phil", "tim", "mark", "jorge", "otto", "norbert", "mel", "tom", "steve", "donnie", "lance", "john", "paul", "mike"];

/** Primer minion libre; si están todos, minion-2, minion-3... */
export function minionName(live: Set<string>): string {
	return MINIONS.find((m) => !live.has(m)) ?? firstFreeName("minion", live);
}

/** Carpeta del worktree de una rama, la misma que usa herdr worktree: ~/.herdr/worktrees/<repo>/<rama>. */
export const tabWorktreePath = (home: string, repo: string, branch: string) => join(home, ".herdr", "worktrees", repo, branch.replace(/[/\\]+/g, "-"));

export interface Split {
	/** Panel que se parte: "anchor" (el del que llama) o el índice de un panel ya creado. */
	from: "anchor" | number;
	direction: "down" | "right";
	/** Fracción que conserva el panel que se parte. */
	ratio: number;
}

/**
 * Cómo colocar n agentes debajo del panel del que llama: el primero debajo (mitad y mitad), los
 * siguientes a su derecha hasta 4 por fila, con el mismo ancho; del quinto en adelante, cada uno
 * debajo del de su columna en la fila anterior.
 */
export function tabLayout(n: number, perRow = 4): Split[] {
	const cols = Math.min(n, perRow);
	return Array.from({ length: n }, (_, i): Split => {
		if (i === 0) return { from: "anchor", direction: "down", ratio: 0.5 };
		if (i < perRow) return { from: i - 1, direction: "right", ratio: Number((1 / (cols - i + 1)).toFixed(4)) };
		return { from: i - perRow, direction: "down", ratio: 0.5 };
	});
}

/** Un worktree, un panel de la pestaña y un minion por rama. */
function openInTab(root: string, anchor: string, plan: Array<{ branch: string; agent: string }>, o: TeamArgs): void {
	const existing = gitWorktrees(root);
	const running = agents(5000);
	const live = new Set(running.map((a) => a.name).filter((n): n is string => !!n));
	const todo: Array<{ branch: string; agent: string; path: string }> = [];
	for (const { branch, agent } of plan) {
		const wt = existing.find((w) => w.branch === branch);
		if (wt && running.some((a) => a.agent && within(canonical(a.cwd ?? a.foreground_cwd ?? "/"), wt.path))) {
			console.log(`${ok("✓")} ${branch}  ${dim(`ya tiene agente (${wt.path})`)}`);
			continue;
		}
		let path = wt?.path;
		if (!path) {
			path = tabWorktreePath(homedir(), basename(root), branch);
			const isNew = git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status !== 0;
			const args = isNew ? ["worktree", "add", "-b", branch, path, o.base ?? "HEAD"] : ["worktree", "add", path, branch];
			const g = git(root, args);
			if (g.status !== 0) {
				warn(`${branch}: git ${args.join(" ")}: ${g.stderr.trim()}`);
				continue;
			}
		}
		todo.push({ branch, agent, path });
	}
	const panes: string[] = [];
	tabLayout(todo.length).forEach((split, i) => {
		const { branch, agent, path } = todo[i];
		try {
			const from = split.from === "anchor" ? anchor : panes[split.from];
			const pane = herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", from, "--direction", split.direction, "--ratio", String(split.ratio), "--cwd", path, "--no-focus"]).pane?.pane_id;
			if (!pane) throw new Error("no pude leer el panel nuevo de la respuesta de Herdr");
			panes.push(pane);
			const name = minionName(live);
			live.add(name);
			run("herdr", ["pane", "rename", pane, `${name} · ${branch}`]);
			let blocked = false;
			try {
				herdr(["agent", "start", name, "--kind", agent, "--pane", pane, "--timeout", "60000", ...(o.agentArgs.length ? ["--", ...o.agentArgs] : [])]);
				blocked = pendingQuestion(name) !== undefined;
			} catch {
				// Suele ser una pregunta del agente (confiar en la carpeta...): no se contesta por ti.
				blocked = agents().find((a) => a.name === name)?.agent_status === "blocked";
			}
			console.log(`${ok("✓")} ${branch}  ${name} (${agent}) en ${pane}${blocked ? caution(" · espera una respuesta tuya") : ""}`);
		} catch (e) {
			// El panel de este no se creó: los que cuelgan de él salen del panel del que llama.
			panes.push(anchor);
			warn(`${branch}: ${(e as Error).message}`);
		}
	});
}

// --- estado de cada rama ------------------------------------------------------------------

export interface GitWorktree {
	path: string;
	branch?: string;
	/** El checkout principal del repo (no un worktree enlazado). */
	main: boolean;
}

/** Worktrees del repo según git (no necesita Herdr). */
export function gitWorktrees(root: string): GitWorktree[] {
	const out: GitWorktree[] = [];
	for (const block of run("git", ["-C", root, "worktree", "list", "--porcelain"]).stdout.split(/\n\n+/)) {
		const path = /^worktree (.+)$/m.exec(block)?.[1];
		if (!path) continue;
		const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
		out.push({ path: canonical(path), branch, main: out.length === 0 });
	}
	return out;
}

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
/**
 * Ruta comparable: real y absoluta. Git, Herdr y el directorio actual pueden dar la misma
 * carpeta de formas distintas (enlaces; en Windows, nombres cortos como RUNNER~1).
 */
export const canonical = (p: string) => {
	try {
		return realpathSync.native(p);
	} catch {
		return resolve(p);
	}
};
/** ¿`p` es `dir` o está dentro? (sin confundir /x/t-a con /x/t-ab) */
const within = (p: string, dir: string) => p === dir || p.startsWith(dir.endsWith(sep) ? dir : dir + sep);
const lines = (s: string) => s.split("\n").filter(Boolean);

export interface BranchInfo {
	ahead: number;
	files: string[];
	dirty: number;
	integrated: boolean;
}

/**
 * Commits y ficheros de la rama respecto a la base, cambios sin commitear en su worktree y si
 * ya está integrada en la base: por fast-forward (es ancestro), por rebase o cherry-pick (cada
 * commit tiene uno equivalente en la base) o por squash (lo que tocó la rama está igual en la base).
 */
export function branchInfo(root: string, base: string, branch: string, path?: string): BranchInfo {
	const ahead = Number(git(root, ["rev-list", "--count", `${base}..${branch}`]).stdout.trim()) || 0;
	const files = lines(git(root, ["diff", "--name-only", `${base}...${branch}`]).stdout);
	const dirty = path && existsSync(path) ? lines(git(path, ["status", "--porcelain"]).stdout).length : 0;
	let integrated = ahead === 0;
	if (!integrated) {
		const cherry = lines(git(root, ["cherry", base, branch]).stdout);
		integrated = cherry.length > 0 && cherry.every((l) => l.startsWith("-"));
	}
	if (!integrated && files.length) integrated = git(root, ["diff", "--quiet", base, branch, "--", ...files]).status === 0;
	return { ahead, files, dirty, integrated };
}

export type State = "trabajando" | "bloqueado" | "sin commitear" | "lista" | "integrada" | "sin commits";

export function classify(i: { agentStatus?: string; dirty: number; ahead: number; integrated: boolean }): State {
	if (i.agentStatus === "working") return "trabajando";
	if (i.agentStatus === "blocked") return "bloqueado";
	if (i.dirty) return "sin commitear";
	if (i.ahead === 0) return "sin commits";
	return i.integrated ? "integrada" : "lista";
}

export interface Row extends BranchInfo {
	branch: string;
	path: string;
	state: State;
	workspace?: string;
	agent?: { name?: string; kind?: string; status?: string; question?: string; pane?: string };
	/** Lo abrió Herdr (tiene workspace o está en su carpeta de worktrees): clean puede quitarlo solo. */
	managed: boolean;
}

/** Rama del checkout principal: la base por defecto. */
export function defaultBase(root: string): string {
	const main = gitWorktrees(root).find((w) => w.main);
	return main?.branch ?? die("el checkout principal no está en una rama: indica la base con --base <ref>");
}

/** Una fila por worktree enlazado del repo, con lo que sepa Herdr si está en marcha. */
export function teamRows(root: string, base = defaultBase(root)): Row[] {
	if (git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).status !== 0) die(`la base no existe: ${base}`);
	const live = serverRunning();
	const open = new Map<string, string>();
	let running: HerdrAgent[] = [];
	if (live) {
		try {
			const list = herdr<{ worktrees?: Array<{ path: string; open_workspace_id?: string | null }> }>(["worktree", "list", "--cwd", root]).worktrees ?? [];
			for (const w of list) if (w.open_workspace_id) open.set(canonical(w.path), w.open_workspace_id);
		} catch {
			// Repo que Herdr no conoce: sin workspaces.
		}
		running = agents(5000);
	}
	const herdrDir = `${sep}.herdr${sep}worktrees${sep}`;
	return gitWorktrees(root)
		.filter((w) => !w.main && w.branch)
		.map((w) => {
			const branch = w.branch as string;
			const info = branchInfo(root, base, branch, w.path);
			const workspace = open.get(w.path);
			const a = running.find((x) => x.agent && ((workspace && x.workspace_id === workspace) || within(canonical(x.cwd ?? x.foreground_cwd ?? "/"), w.path)));
			// Herdr da por idle a un agente con una pregunta en pantalla (pi: confiar en la carpeta).
			const question = a?.name && a.agent_status !== "working" && a.agent_status !== "blocked" ? pendingQuestion(a.name) : undefined;
			return {
				...info,
				branch,
				path: w.path,
				workspace,
				agent: a ? { name: a.name, kind: a.agent, status: a.agent_status, question, pane: a.pane_id } : undefined,
				state: classify({ agentStatus: question ? "blocked" : a?.agent_status, ...info }),
				managed: !!workspace || w.path.includes(herdrDir),
			};
		});
}

const STATE_COLOR: Record<State, (s: string) => string> = {
	trabajando: caution,
	bloqueado: bad,
	"sin commitear": caution,
	lista: ok,
	integrada: dim,
	"sin commits": dim,
};

function printStatus(rows: Row[]): void {
	if (!rows.length) return console.log("Sin worktrees en este repo. Crea un equipo con: bond team <rama>...");
	const head = ["RAMA", "ESTADO", "AGENTE", "COMMITS", "FICHEROS", "DÓNDE"];
	const table = rows.map((r) => [
		r.branch,
		r.state + (r.agent?.question ? `: ${r.agent.question}` : "") + (r.dirty && r.state !== "sin commitear" ? ` (+${r.dirty} sin commitear)` : ""),
		r.agent ? `${r.agent.name ?? "?"} (${r.agent.kind})` : "-",
		r.ahead ? `+${r.ahead}` : "-",
		r.files.length ? String(r.files.length) : "-",
		r.workspace ?? (r.agent?.pane ? `panel ${r.agent.pane}` : dim("cerrado")),
	]);
	const w = head.map((h, i) => Math.max(h.length, ...table.map((t) => t[i].replace(/\x1b\[[0-9;]*m/g, "").length)));
	const fmt = (t: string[]) => t.map((c, i) => (i === t.length - 1 ? c : c + " ".repeat(Math.max(0, w[i] - c.replace(/\x1b\[[0-9;]*m/g, "").length)))).join("  ");
	console.log(fmt(head));
	rows.forEach((r, i) => {
		const t = [...table[i]];
		t[1] = STATE_COLOR[r.state](t[1]);
		console.log(fmt(t));
	});
	if (rows.some((r) => r.agent?.question)) {
		console.log(caution("\n  Contesta tú en su panel: bond no responde por ti."));
		console.log(dim('  En pi, "Trust parent folder" una vez basta para todos los worktrees de este repo.'));
	}
}

function parseCommon(args: string[], flags: string[], valued: string[]): { positional: string[]; opts: Record<string, string | true> } {
	const positional: string[] = [];
	const opts: Record<string, string | true> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (valued.includes(a)) opts[a] = args[++i] ?? die(`${a} necesita un valor (bond team --help)`);
		else if (flags.includes(a)) opts[a] = true;
		else if (a.startsWith("-")) die(`opción desconocida: ${a} (bond team --help)`);
		else positional.push(a);
	}
	return { positional, opts };
}

function status(args: string[]): void {
	const { positional, opts } = parseCommon(args, ["--json", "-j"], ["--base", "-b"]);
	if (positional.length > 1) die("uso: bond team status [repo] [--base <ref>] [--json]");
	const root = repoOf(positional[0]);
	const rows = teamRows(root, (opts["--base"] ?? opts["-b"]) as string | undefined);
	if (opts["--json"] || opts["-j"]) return console.log(JSON.stringify(rows, null, 2));
	printStatus(rows);
}

// --- mandar trabajo -------------------------------------------------------------------------

function prompt(args: string[]): void {
	requireHerdr();
	const { positional, opts } = parseCommon(args, ["--wait"], ["--timeout"]);
	const [branch, ...words] = positional;
	if (!branch || !words.length) die('uso: bond team prompt <rama> "la tarea" [--wait] [--timeout <ms>]');
	const rows = teamRows(repoOf());
	const row = rows.find((r) => r.branch === branch) ?? die(`no hay worktree para ${branch} (bond team status)`);
	const name = row.agent?.name ?? die(`${branch} no tiene un agente en marcha (bond team ${branch} para abrirlo)`);
	// Con una pregunta en pantalla, el Enter del prompt la contestaría por ti y la tarea se perdería.
	if (row.state === "bloqueado") die(`${name} espera una respuesta tuya${row.agent?.question ? ` (${row.agent.question})` : ""}: contéstale en su panel (herdr workspace focus ${row.workspace}) y repite`);
	const extra = [...(opts["--wait"] ? ["--wait"] : []), ...(opts["--timeout"] ? ["--timeout", opts["--timeout"] as string] : [])];
	// Sin límite de tiempo propio: con --wait puede tardar lo que tarde el agente.
	const r = spawnSync("herdr", ["agent", "prompt", name, words.join(" "), ...extra], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
	let parsed: { result?: { agent?: { agent_status?: string } }; error?: { message?: string } } = {};
	try {
		parsed = JSON.parse(r.stdout || r.stderr || "{}");
	} catch {
		// Salida no JSON.
	}
	if (r.status !== 0 || parsed.error) die(`${name}: ${parsed.error?.message ?? (r.stderr || r.stdout).trim()}`);
	console.log(`${ok("✓")} ${branch} → ${name}${opts["--wait"] ? `  ${dim(parsed.result?.agent?.agent_status ?? "")}` : ""}`);
}

// --- quitar worktrees -----------------------------------------------------------------------

function clean(args: string[]): void {
	const { positional, opts } = parseCommon(args, ["--force", "--delete-branch", "--dry-run"], ["--base", "-b"]);
	const force = !!opts["--force"];
	const dir = positional.length && existsSync(positional[0]) ? positional.shift() : undefined;
	const root = repoOf(dir);
	const rows = teamRows(root, (opts["--base"] ?? opts["-b"]) as string | undefined);
	const unknown = positional.filter((b) => !rows.some((r) => r.branch === b));
	if (unknown.length) die(`sin worktree: ${unknown.join(", ")} (bond team status)`);

	const targets = positional.length ? rows.filter((r) => positional.includes(r.branch)) : rows.filter((r) => r.state === "integrada" && r.managed);
	if (!positional.length) {
		const outside = rows.filter((r) => r.state === "integrada" && !r.managed);
		for (const r of outside) console.log(dim(`  ${r.branch}: integrada, pero no la abrió Herdr (${r.path}); nómbrala para quitarla`));
	}
	if (!targets.length) return console.log(positional.length ? "Nada que quitar." : "Ninguna rama integrada que quitar (bond team status).");

	const cwd = canonical(process.cwd());
	let removed = 0;
	let removedWorkspace = false;
	for (const r of targets) {
		const why =
			r.state === "trabajando" ? "el agente está trabajando" : r.state === "sin commitear" || r.dirty ? `${r.dirty} cambio(s) sin commitear` : within(cwd, r.path) ? "estás dentro" : r.state === "bloqueado" ? "el agente espera una respuesta" : undefined;
		if (why && !force) {
			warn(`${r.branch}: no lo quito, ${why} (--force para quitarlo igualmente)`);
			continue;
		}
		// En modo pestaña el agente vive en un panel suelto: se cierra con él.
		const pane = !r.workspace && r.managed ? r.agent?.pane : undefined;
		const what = r.workspace ? `herdr worktree remove --workspace ${r.workspace}${force ? " --force" : ""}` : `${pane ? `herdr pane close ${pane}; ` : ""}git worktree remove ${force ? "--force " : ""}${r.path}`;
		try {
			act(what, () => {
				if (pane) herdr(["pane", "close", pane]);
				if (r.workspace) herdr(["worktree", "remove", "--workspace", r.workspace, ...(force ? ["--force"] : [])]);
				else {
					const g = git(root, ["worktree", "remove", ...(force ? ["--force"] : []), r.path]);
					if (g.status !== 0) throw new Error(g.stderr.trim());
				}
				// Herdr deja la carpeta del repo dentro de la suya: se quita si queda vacía.
				const parent = dirname(r.path);
				if (r.managed && existsSync(parent) && readdirSync(parent).length === 0) rmdirSync(parent);
			});
		} catch (e) {
			warn(`${r.branch}: ${(e as Error).message}`);
			continue;
		}
		removed++;
		if (r.workspace) removedWorkspace = true;
		let branchNote = "rama conservada";
		if (opts["--delete-branch"]) {
			if (r.integrated || force) {
				act(`git branch -D ${r.branch}`, () => {
					const g = git(root, ["branch", "-D", r.branch]);
					if (g.status !== 0) throw new Error(g.stderr.trim());
				});
				branchNote = "rama borrada";
			} else branchNote = "rama conservada: no está integrada (--force para borrarla)";
		}
		console.log(`${ok("-")} ${r.branch}  ${dim(`${r.path} · ${branchNote}`)}`);
	}
	if (!isDryRun()) git(root, ["worktree", "prune"]);
	if (!removedWorkspace) return;

	// El workspace del repo que abrió bond team para colgar los worktrees: se avisa, no se cierra.
	if (serverRunning() && !rows.some((r) => r.workspace && !targets.includes(r))) {
		const name = basename(root);
		const ws = workspaces().find((w) => w.label === `bond:${name}` || w.label === `pi:${name}`);
		if (ws) console.log(dim(`  El workspace del repo (${ws.label}) sigue abierto; si ya no lo usas: herdr workspace close ${ws.workspace_id}`));
	}
}

// --- entrada --------------------------------------------------------------------------------

/** `bond team`: crear el equipo, o sus subcomandos (status, prompt, clean). */
export async function team(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "status") return status(rest);
	if (sub === "prompt") return prompt(rest);
	if (sub === "clean") return clean(rest);
	return create(args);
}
