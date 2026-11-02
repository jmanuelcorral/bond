// `bond team`: un agente por rama, cada uno en su worktree, y lo que viene después: ver cómo va
// cada rama (status), mandar trabajo a la de una rama (prompt) y quitar los worktrees que ya no
// hacen falta (clean). Las ramas no se tocan: nada de merge, push ni borrado sin pedirlo.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { loadDecisions, parseFm, type Parsed, resolveAuthor, slugify } from "./decisions.mts";
import { type HubRepo, type HubSession, hubRoot, hubSession, warnedInvalidHub } from "./hub.mts";
import { chooseAgent, gitRoot, openWorkspace } from "./launch.mts";
import { agents, defaultAgentArgs, ensureServer, firstFreeName, herdr, type HerdrAgent, insideHerdr, preparePane, questionIn, requireHerdr, serverRunning, startedBlocked, startupNoticeIn, visibleScreen, workspaces } from "./herdr.mts";
import { repoDecisions } from "./repo.mts";
import { inheritTrust, TRUST_KINDS, trusts } from "./trust.mts";
import { act, canonical, caution, catchDie, die, dim, isDryRun, ok, run, warn } from "./util.mts";
import { t } from "./messages.mts";

export const teamHelp = (): string => t("team.help");
export const TEAM_HELP = Object.assign(() => teamHelp(), {
	toString: () => teamHelp(),
	[Symbol.for("nodejs.util.inspect.custom")]: () => teamHelp(),
});

// --- crear el equipo ----------------------------------------------------------------------

export interface TeamArgs {
	dir?: string;
	agent?: string;
	base?: string;
	trust: boolean;
	/** Dónde van los agentes si no caben en la pestaña; sin él, se pregunta (o pestañas nuevas). */
	layout?: Layout;
	/** No preguntar: sin layout, pestañas nuevas. */
	yes: boolean;
	/** En paneles: el worktree hereda la confianza del checkout principal (pi, Claude, agy). */
	inheritTrust: boolean;
	specs: Array<{ branch: string; agent?: string }>;
	agentArgs: string[];
	/** En un hub: solo estos repos de la sesión (--repos). */
	repos?: string[];
}

/**
 * Argumentos de bond team. El primero es el repo solo si es una carpeta que existe; si no, es
 * ya una rama (bond team feat/a feat/b:claude, dentro del repo).
 */
export function parseTeam(args: string[], isDir: (p: string) => boolean = existsSync): TeamArgs {
	const o: TeamArgs = { trust: false, yes: false, inheritTrust: true, specs: [], agentArgs: [] };
	const pick = (flag: string, layout: Layout) => {
		if (o.layout && o.layout !== layout) die(t("team.err_flag_conflict", { flag, layout: o.layout }));
		o.layout = layout;
	};
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(t("team.err_needs_value", { flag: a }));
		if (a === "-k" || a === "--kind" || a === "-a" || a === "--agent") o.agent = val();
		else if (a === "-b" || a === "--base") o.base = val();
		else if (a === "--trust-repository") o.trust = true;
		else if (a === "--workspaces") pick(a, "workspaces");
		else if (a === "--tabs") pick(a, "tabs");
		else if (a === "--same-tab") pick(a, "same-tab");
		else if (a === "-y" || a === "--yes") o.yes = true;
		else if (a === "--no-trust") o.inheritTrust = false;
		else if (a === "--repos") o.repos = val().split(",").map((x) => x.trim()).filter(Boolean);
		else if (a === "--") {
			o.agentArgs = args.slice(i + 1);
			break;
		} else if (a.startsWith("-")) die(t("team.err_unknown_opt", { opt: a }));
		else positional.push(a);
	}
	if (positional.length && isDir(positional[0])) o.dir = positional.shift();
	const seen = new Set<string>();
	for (const spec of positional) {
		const [branch, agent, ...extra] = spec.split(":");
		if (!branch || extra.length || agent === "") die(t("team.err_malformed_spec", { spec }));
		if (seen.has(branch)) die(t("team.err_duplicate_branch", { branch }));
		seen.add(branch);
		o.specs.push({ branch, agent });
	}
	if (!o.specs.length) die(t("team.err_missing_branches"), 2);
	return o;
}

const repoOf = (dir?: string) => gitRoot(resolve(dir ?? ".")) ?? die(t("team.err_not_git_repo", { path: resolve(dir ?? ".") }));

async function create(args: string[]): Promise<void> {
	requireHerdr();
	const o = parseTeam(args);
	const root = repoOf(o.dir);
	const session = hubOf(root);
	if (session) return createInHub(session, o);
	if (o.repos) die(t("team.err_repos_only_hub"));
	// Antes de tocar Herdr: un nombre de rama inválido dejaría un workspace a medias.
	const invalid = o.specs.filter((s) => run("git", ["-C", root, "check-ref-format", "--branch", s.branch]).status !== 0).map((s) => s.branch);
	if (invalid.length) die(t("team.err_invalid_branch_name", { branches: invalid.map((b) => JSON.stringify(b)).join(", ") }));

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
	if (foreign.length) warn(t("team.warn_foreign_agent", { agents: foreign.join(", ") }));
	if (run("git", ["-C", root, "status", "--porcelain"]).stdout.trim()) warn(t("team.warn_uncommitted_changes"));

	if (!insideHerdr()) await ensureServer();
	const anchor = insideHerdr() ? process.env.HERDR_PANE_ID : undefined;
	if (anchor) {
		// Antes de crear nada: si no caben en la pestaña, se elige dónde van.
		const hub = hubRoot(root);
		const repo = hub ? basename(hub) : basename(root);
		const tab = callerTab(root, anchor);
		const pending = pendingInTab(root, plan);
		let layout = o.layout ?? "tabs";
		if (!o.layout && pending.todo.length > tab.room && !o.yes && process.stdin.isTTY && process.stdout.isTTY) layout = await askLayout(pending.todo.length, tab.room, repo);
		if (layout === "workspaces") openWorkspaces(root, plan, o);
		else openInTab(root, anchor, tab, layout === "same-tab" ? Number.POSITIVE_INFINITY : tab.room, pending, o);
		openWatch(root, anchor, o.base);
	} else openWorkspaces(root, plan, o);
	const { renderSmall } = await import("../lib/bond-logo.mts");
	const hub = hubRoot(root);
	const repo = hub ? basename(hub) : basename(root);
	console.log(`\n  ${renderSmall(60, t("team.logo_team_in", { repo }))}\n`);
	printStatus(teamRows(root, o.base));
	console.log(dim(t("team.footer_hints")));
}

/** Un workspace por rama con herdr worktree (fuera de Herdr, o con --workspaces). */
function openWorkspaces(root: string, plan: PlanItem[], o: TeamArgs): void {
	for (const item of plan) {
		const { branch, agent } = item;
		try {
			const r = openWorkspace({ dir: item.root ?? root, agent, worktree: branch, base: item.base ?? o.base, shell: false, direction: "right", ratio: "0.6", focus: false, trust: o.trust, agentArgs: defaultAgentArgs(agent, o.agentArgs) });
			if (r.agentPane && r.agentName && !r.reused) {
				run("herdr", ["pane", "rename", r.agentPane, `${r.agentName} · ${itemLabel(item)}`]);
			}
			const detail = r.reused
				? dim(t("team.ws_already_open", { ws: r.ws }))
				: `${t("team.agent_in_pane", { name: r.agentName ?? "", agent, pane: r.agentPane ?? "" })}${r.blocked ? caution(t("team.awaits_reply")) : ""}`;
			console.log(`${ok("✓")} ${itemLabel(item)}  ${detail}`);
		} catch (e) {
			warn(`${itemLabel(item)}: ${(e as Error).message}`);
		}
	}
}

// --- equipo en la pestaña -------------------------------------------------------------------

/** Dónde van los agentes que no caben en la pestaña del que llama. */
export type Layout = "tabs" | "same-tab" | "workspaces";

/** Paneles que admite la pestaña del que llama: el suyo, el de la tabla y 4 minions. */
export const TAB_CAP = 6;

/** Minions que caben aún en la pestaña: el tope menos los paneles que ya tiene y el de la tabla si falta. */
export const tabRoom = (panes: number, hasWatch: boolean, cap = TAB_CAP) => Math.max(0, cap - panes - (hasWatch ? 0 : 1));

/** Título de la n-ésima pestaña nueva del equipo (desde 1). */
export const teamTabLabel = (repo: string, n: number) => (n > 1 ? t("team.tab_label_n", { repo, n }) : t("team.tab_label", { repo }));

interface CallerTab {
	workspace?: string;
	/** Minions que caben aún en la pestaña. */
	room: number;
}

/** La pestaña del que llama y cuántos minions le caben; si Herdr no responde, los 4 de una pestaña con solo el tuyo. */
export function callerTab(root: string, anchor: string): CallerTab {
	try {
		const me = herdr<{ pane?: HerdrPane }>(["pane", "get", anchor]).pane;
		const panes = (herdr<{ panes?: HerdrPane[] }>(["pane", "list", ...(me?.workspace_id ? ["--workspace", me.workspace_id] : [])]).panes ?? []).filter((p) => p.tab_id === me?.tab_id);
		const hub = hubRoot(root);
		const repo = hub ? basename(hub) : basename(root);
		return { workspace: me?.workspace_id, room: tabRoom(panes.length, !!findWatchPane(panes, me?.tab_id, repo)) };
	} catch {
		return { room: tabRoom(1, false) };
	}
}

const LAYOUT_CHOICES: Array<{ layout: Layout; text: (room: number, repo: string) => string }> = [
	{
		layout: "tabs",
		text: (room, repo) =>
			room
				? t("team.layout_tabs_split", { room, tab: teamTabLabel(repo, 1) })
				: t("team.layout_tabs_all", { tab: teamTabLabel(repo, 1) }),
	},
	{ layout: "same-tab", text: () => t("team.layout_same_tab") },
	{ layout: "workspaces", text: () => t("team.layout_workspaces") },
];

/** Pregunta dónde van los agentes que no caben; Intro elige la 1. */
async function askLayout(n: number, room: number, repo: string): Promise<Layout> {
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	let answered = false;
	const cancel = () => {
		if (answered) return;
		console.log(dim(t("team.layout_cancelled")));
		process.exit(130);
	};
	rl.on("SIGINT", cancel);
	rl.on("close", cancel);
	console.log(
		room === 1
			? t("team.ask_layout_title_one", { n, cap: TAB_CAP })
			: t("team.ask_layout_title_many", { n, room, cap: TAB_CAP }),
	);
	LAYOUT_CHOICES.forEach((c, i) => console.log(`  ${i + 1}) ${c.text(room, repo)}`));
	try {
		for (;;) {
			const a = (await rl.question(t("team.ask_layout_prompt"))).trim() || "1";
			const choice = /^[1-9]$/.test(a) ? LAYOUT_CHOICES[Number(a) - 1] : undefined;
			if (choice) {
				answered = true;
				return choice.layout;
			}
			console.log(t("team.ask_layout_hint", { choices: LAYOUT_CHOICES.map((_, i) => i + 1).join(", ") }));
		}
	} finally {
		answered = true;
		rl.close();
	}
}

/** Nombres de los minions, en orden: cada agente de bond team coge el primero libre en Herdr. */
export const MINIONS = ["kevin", "stuart", "bob", "dave", "jerry", "carl", "phil", "tim", "mark", "jorge", "otto", "norbert", "mel", "tom", "steve", "donnie", "lance", "john", "paul", "mike"];

/** Primer minion libre; si están todos, minion-2, minion-3... */
export function minionName(live: Set<string>): string {
	return MINIONS.find((m) => !live.has(m)) ?? firstFreeName("minion", live);
}

/**
 * Carpeta del worktree de una rama, la misma que usa herdr worktree: ~/.herdr/worktrees/<repo>/<rama>.
 * En un hub, `sub` es la ruta del submódulo (con / cambiadas por -): ~/.herdr/worktrees/<hub>/<sub>/<rama> (D9).
 */
export const tabWorktreePath = (home: string, repo: string, branch: string, sub?: string) =>
	join(home, ".herdr", "worktrees", repo, ...(sub ? [sub.replace(/[/\\]+/g, "-")] : []), branch.replace(/[/\\]+/g, "-"));

/**
 * Dónde va cada agente. `tab`: 0 es la pestaña del que llama; 1, 2... las pestañas nuevas.
 * `from`: "tab" es el panel con el que nace una pestaña nueva; si no, el panel que se parte,
 * "anchor" (el del que llama) o el índice de un panel ya creado.
 */
export type Split = { tab: number; from: "tab" } | { tab: number; from: "anchor" | number; direction: "down" | "right"; /** Fracción que conserva el panel que se parte. */ ratio: number };

const share = (n: number) => Number((1 / n).toFixed(4));

/**
 * Cómo colocar n agentes con `room` huecos en la pestaña del que llama. En ella, el primero
 * debajo (mitad y mitad) y los siguientes a su derecha hasta `perRow` por fila, con el mismo
 * ancho; de ahí en adelante, cada uno debajo del de su columna en la fila anterior. Los que no
 * caben van a pestañas nuevas, `perRow` por pestaña y en fila, con el mismo ancho.
 */
export function tabLayout(n: number, room = Number.POSITIVE_INFINITY, perRow = 4): Split[] {
	const here = Math.min(n, room);
	const cols = Math.min(here, perRow);
	return Array.from({ length: n }, (_, i): Split => {
		if (i < here) {
			if (i === 0) return { tab: 0, from: "anchor", direction: "down", ratio: 0.5 };
			if (i < perRow) return { tab: 0, from: i - 1, direction: "right", ratio: share(cols - i + 1) };
			return { tab: 0, from: i - perRow, direction: "down", ratio: 0.5 };
		}
		const j = (i - here) % perRow;
		const tab = Math.floor((i - here) / perRow) + 1;
		if (j === 0) return { tab, from: "tab" };
		return { tab, from: i - 1, direction: "right", ratio: share(Math.min(perRow, n - (i - j)) - j + 1) };
	});
}

/**
 * Una rama a abrir. En un hub, además, el submódulo (`root`, su ruta `sub` en la sesión) y la
 * base de la que sale su worktree.
 */
interface PlanItem {
	branch: string;
	agent: string;
	root?: string;
	sub?: string;
	base?: string;
}

/** Cómo se nombra una rama en la salida: en un hub, con su submódulo. */
const itemLabel = (i: { branch: string; sub?: string }) => (i.sub ? `${i.branch} · ${i.sub}` : i.branch);

interface Pending {
	/** Ramas sin agente en marcha, con su worktree si ya existe. */
	todo: Array<PlanItem & { path?: string }>;
	/** Ramas que ya tienen agente, con la carpeta de su worktree. */
	skipped: Array<{ branch: string; sub?: string; path: string }>;
	/** Nombres de agente en uso en Herdr. */
	live: Set<string>;
}

/** Qué ramas necesitan agente (sin crear nada todavía). */
function pendingInTab(root: string, plan: PlanItem[]): Pending {
	const running = agents(5000);
	const out: Pending = { todo: [], skipped: [], live: new Set(running.map((a) => a.name).filter((n): n is string => !!n)) };
	const existing = new Map<string, GitWorktree[]>();
	for (const item of plan) {
		const at = item.root ?? root;
		if (!existing.has(at)) existing.set(at, gitWorktrees(at));
		const wt = existing.get(at)?.find((w) => w.branch === item.branch);
		if (wt && running.some((a) => a.agent && within(canonical(a.cwd ?? a.foreground_cwd ?? "/"), wt.path))) out.skipped.push({ branch: item.branch, sub: item.sub, path: wt.path });
		else out.todo.push({ ...item, path: wt?.path });
	}
	return out;
}

/**
 * El orquestador: el agente del panel que lanza el equipo (pi, Claude Code o agy), si confía en el
 * checkout principal. Su confianza vale para todos los agentes del equipo.
 */
function trustingOrchestrator(root: string, anchor: string): string | undefined {
	const kind = agents(5000).find((a) => a.pane_id === anchor && a.agent)?.agent;
	return kind && TRUST_KINDS.includes(kind) && trusts(kind, root) ? kind : undefined;
}

/** Un worktree, un panel y un minion por rama: en la pestaña del que llama hasta `room`, el resto en pestañas nuevas. */
function openInTab(root: string, anchor: string, here: CallerTab, room: number, pending: Pending, o: TeamArgs): void {
	const { live } = pending;
	const orchestrator = o.inheritTrust ? trustingOrchestrator(canonical(root), anchor) : undefined;
	for (const s of pending.skipped) console.log(`${ok("✓")} ${itemLabel(s)}  ${dim(t("team.already_has_agent", { path: s.path }))}`);
	const todo: Array<PlanItem & { path: string }> = [];
	for (const item of pending.todo) {
		const { branch } = item;
		const at = item.root ?? root;
		let path = item.path;
		if (!path) {
			path = tabWorktreePath(homedir(), basename(root), branch, item.sub);
			const isNew = git(at, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status !== 0;
			const args = isNew ? ["worktree", "add", "-b", branch, path, item.base ?? o.base ?? "HEAD"] : ["worktree", "add", path, branch];
			const g = git(at, args);
			if (g.status !== 0) {
				warn(`${itemLabel(item)}: git ${args.join(" ")}: ${g.stderr.trim()}`);
				continue;
			}
		}
		todo.push({ ...item, path });
	}
	const repo = basename(root);
	const panes: Array<string | undefined> = [];
	/** Panel con el que nació cada pestaña nueva. */
	const roots: Array<string | undefined> = [];
	tabLayout(todo.length, room).forEach((split, i) => {
		const { branch, agent, path } = todo[i];
		const label = itemLabel(todo[i]);
		try {
			let pane: string | undefined;
			const from = split.from === "tab" ? undefined : split.from === "anchor" ? anchor : panes[split.from];
			if (split.from === "tab" || !from) {
				// Pestaña nueva (o la anterior no llegó a crearse): su panel es el del agente.
				pane = herdr<{ root_pane?: { pane_id: string } }>(["tab", "create", ...(here.workspace ? ["--workspace", here.workspace] : []), "--cwd", path, "--label", teamTabLabel(repo, split.tab), "--no-focus"]).root_pane?.pane_id;
				roots[split.tab] = pane;
			} else if ("direction" in split) pane = herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", from, "--direction", split.direction, "--ratio", String(split.ratio), "--cwd", path, "--no-focus"]).pane?.pane_id;
			if (!pane) throw new Error(t("team.err_herdr_pane_read"));
			panes.push(pane);
			const name = minionName(live);
			live.add(name);
			run("herdr", ["pane", "rename", pane, `${name} · ${label}`]);
			let trusted = false;
			if (o.inheritTrust && TRUST_KINDS.includes(agent)) {
				try {
					trusted = inheritTrust(agent, canonical(todo[i].root ?? root), canonical(path), undefined, !!orchestrator) === "heredada";
				} catch (e) {
					warn(t("team.warn_trust_inherit_failed", { label, error: (e as Error).message, agent }));
				}
			}
			let blocked = false;
			const agentArgs = defaultAgentArgs(agent, o.agentArgs);
			preparePane(pane, agent);
			try {
				herdr(["agent", "start", name, "--kind", agent, "--pane", pane, "--timeout", "60000", ...(agentArgs.length ? ["--", ...agentArgs] : [])]);
				blocked = startedBlocked(name, false);
			} catch {
				// Suele ser una pregunta del agente (confiar en la carpeta...): no se contesta por ti.
				blocked = startedBlocked(name, true);
			}
			const paneText = t("team.agent_in_pane", { name, agent, pane });
			const tabText = split.tab ? dim(` · ${teamTabLabel(repo, split.tab)}`) : "";
			const trustText = trusted ? dim(t("team.trust_inherited")) : "";
			const blockedText = blocked ? caution(t("team.awaits_reply")) : "";
			console.log(`${ok("✓")} ${label}  ${paneText}${tabText}${trustText}${blockedText}`);
		} catch (e) {
			// El panel de este no se creó: los que cuelgan de él salen del panel del que llama, o
			// del primero de su pestaña nueva (si tampoco está, se crea la pestaña con el siguiente).
			panes.push(split.tab ? roots[split.tab] : anchor);
			warn(`${label}: ${(e as Error).message}`);
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
/** ¿`p` es `dir` o está dentro? (sin confundir /x/t-a con /x/t-ab) */
const within = (p: string, dir: string) => p === dir || p.startsWith(dir.endsWith(sep) ? dir : dir + sep);
const lines = (s: string) => s.split("\n").filter(Boolean);

export interface BranchInfo {
	ahead: number;
	files: string[];
	dirty: number;
	/** No tiene nada que no esté ya en la base (se puede borrar sin perder trabajo). */
	integrated: boolean;
	/** Ha tenido commits desde que se creó: sin commits por delante, es que ya se integró. */
	worked: boolean;
}

/**
 * Commits y ficheros de la rama respecto a la base, cambios sin commitear en su worktree y si
 * ya está integrada en la base: por fast-forward (es ancestro), por rebase o cherry-pick (cada
 * commit tiene uno equivalente en la base) o por squash (lo que tocó la rama está igual en la base).
 */
export function branchInfo(root: string, base: string, branch: string, path?: string): BranchInfo {
	const ahead = Number(git(root, ["rev-list", "--count", `${base}..${branch}`]).stdout.trim()) || 0;
	// Tras un merge o un fast-forward la rama ya no tiene commits por delante de la base, igual
	// que una recién creada. Las distingue el reflog: su primera entrada es el commit del que
	// salió; si la punta ya no es ese, la rama trabajó. Sin reflog, como antes: sin commits.
	const created = lines(git(root, ["reflog", "show", "--format=%H", `refs/heads/${branch}`, "--"]).stdout).pop();
	const tip = git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).stdout.trim();
	const worked = ahead > 0 || (!!created && !!tip && created !== tip);
	const files = lines(git(root, ["diff", "--name-only", `${base}...${branch}`]).stdout);
	const dirty = path && existsSync(path) ? lines(git(path, ["status", "--porcelain"]).stdout).length : 0;
	let integrated = ahead === 0;
	if (!integrated) {
		const cherry = lines(git(root, ["cherry", base, branch]).stdout);
		integrated = cherry.length > 0 && cherry.every((l) => l.startsWith("-"));
	}
	if (!integrated && files.length) integrated = git(root, ["diff", "--quiet", base, branch, "--", ...files]).status === 0;
	return { ahead, files, dirty, integrated, worked };
}

export type State = "trabajando" | "bloqueado" | "sin commitear" | "lista" | "integrada" | "sin commits";

export function classify(i: { agentStatus?: string; dirty: number; ahead: number; integrated: boolean; worked?: boolean }): State {
	if (i.agentStatus === "working") return "trabajando";
	if (i.agentStatus === "blocked") return "bloqueado";
	if (i.dirty) return "sin commitear";
	// Sin commits por delante: si trabajó, ya está en la base (merge o fast-forward).
	if (i.ahead === 0) return i.worked ? "integrada" : "sin commits";
	return i.integrated ? "integrada" : "lista";
}

export interface Row extends BranchInfo {
	branch: string;
	path: string;
	state: State;
	workspace?: string;
	/** notice: Herdr lo da por blocked, pero solo enseña el aviso de arranque de agy. */
	agent?: { name?: string; kind?: string; status?: string; question?: string; pane?: string; notice?: boolean };
	/** Lo abrió Herdr (tiene workspace o está en su carpeta de worktrees): clean puede quitarlo solo. */
	managed: boolean;
	/** Repo de la sesión en modo hub (p. ej. "front", "front/libs/lib", o el nombre del hub). */
	repo?: string;
	/** Base contra la que se comparó la rama (en modo hub, la base de ese repo). */
	base?: string;
}

/** Rama del checkout principal: la base por defecto. */
export function defaultBase(root: string): string {
	const main = gitWorktrees(root).find((w) => w.main);
	return main?.branch ?? die(t("team.err_main_not_on_branch"));
}

/** Bases de repos de la sesión ya avisadas por no existir (una vez por ejecución). */
export const warnedMissingBases = new Set<string>();

export interface HerdrPane {
	pane_id: string;
	tab_id?: string;
	workspace_id?: string;
	label?: string;
	focused?: boolean;
}

/**
 * Resuelve el agente de una rama según el panel que bond team renombró al crearla:
 * `<nombre> · <rama>` (o en un hub: `<nombre> · <rama> · <submódulo>`).
 * Enruta al agente emparejado por pane_id o nombre; si no existe o está obsoleto,
 * devuelve undefined para que quien llame falle en lugar de elegir a ciegas por cwd.
 */
export function findBranchAgent(
	branch: string,
	panes: HerdrPane[],
	running: HerdrAgent[],
	sub?: string,
	workspaceId?: string,
): HerdrAgent | undefined {
	const label = itemLabel({ branch, sub: sub && sub !== "." ? sub : undefined });
	const suffix = ` · ${label}`;
	const pane = panes.find((p) => p.label && p.label.endsWith(suffix) && p.label.length > suffix.length);
	if (pane) {
		const name = pane.label!.slice(0, -suffix.length);
		return running.find((x) => x.agent && (x.pane_id === pane.pane_id || x.name === name));
	}
	if (workspaceId) {
		const inWs = running.filter((x) => x.agent && x.workspace_id === workspaceId);
		if (inWs.length === 1) return inWs[0];
	}
	return undefined;
}

/** Una fila por worktree enlazado del repo, con lo que sepa Herdr si está en marcha. */
export function teamRows(root: string, base = defaultBase(root)): Row[] {
	if (git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).status !== 0) die(t("team.err_base_not_found", { base }));
	const live = serverRunning();
	const open = new Map<string, string>();
	let running: HerdrAgent[] = [];
	let panes: HerdrPane[] = [];
	if (live) {
		try {
			const list = herdr<{ worktrees?: Array<{ path: string; open_workspace_id?: string | null }> }>(["worktree", "list", "--cwd", root]).worktrees ?? [];
			for (const w of list) if (w.open_workspace_id) open.set(canonical(w.path), w.open_workspace_id);
		} catch {
			// Repo que Herdr no conoce: sin workspaces.
		}
		try {
			panes = herdr<{ panes?: HerdrPane[] }>(["pane", "list"]).panes ?? [];
		} catch {
			// Repo que Herdr no conoce: sin paneles.
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
			const a = findBranchAgent(branch, panes, running, undefined, workspace);
			// Herdr da por idle a un agente con una pregunta en pantalla (pi: confiar en la carpeta)
			// y puede dar por blocked el aviso de arranque de agy, que no es una pregunta.
			const screen = a?.name && a.agent_status !== "working" ? visibleScreen(a.name) : "";
			const question = a?.agent_status !== "blocked" ? questionIn(screen) : undefined;
			const notice = a?.agent_status === "blocked" && startupNoticeIn(screen);
			const status = notice ? "idle" : a?.agent_status;
			return {
				...info,
				branch,
				path: w.path,
				workspace,
				agent: a ? { name: a.name, kind: a.agent, status, question, pane: a.pane_id, ...(notice ? { notice } : {}) } : undefined,
				state: classify({ agentStatus: question ? "blocked" : status, ...info }),
				managed: !!workspace || w.path.includes(herdrDir),
			};
		});
}

/**
 * Filas de toda la sesión de trabajo. Si root (o un superproyecto que lo contiene) tiene un
 * hub.toml válido, devuelve las filas de cada repo de la sesión (cada una con `repo` y `base`
 * fijados a su base en hub.toml). Si no es un hub, devuelve teamRows(root, base).
 */
export function sessionRows(root: string, base?: string): Row[] {
	const hub = hubRoot(root);
	const session = hub ? hubSession(hub) : undefined;
	if (!session) return teamRows(root, base);

	const live = serverRunning();
	const open = new Map<string, string>();
	let running: HerdrAgent[] = [];
	let panes: HerdrPane[] = [];
	const herdrDir = `${sep}.herdr${sep}worktrees${sep}`;

	if (live) {
		for (const hr of session.repos) {
			if (!hr.present) continue;
			try {
				const list = herdr<{ worktrees?: Array<{ path: string; open_workspace_id?: string | null }> }>(["worktree", "list", "--cwd", hr.dir]).worktrees ?? [];
				for (const w of list) if (w.open_workspace_id) open.set(canonical(w.path), w.open_workspace_id);
			} catch {
				// Repo que Herdr no conoce: sin workspaces.
			}
		}
		try {
			panes = herdr<{ panes?: HerdrPane[] }>(["pane", "list"]).panes ?? [];
		} catch {
			// Sin respuesta de Herdr.
		}
		running = agents(5000);
	}

	const rows: Row[] = [];
	for (const hr of session.repos) {
		if (!hr.present) continue;
		if (git(hr.dir, ["rev-parse", "--verify", "--quiet", `${hr.base}^{commit}`]).status !== 0) {
			if (!warnedMissingBases.has(hr.dir)) {
				warnedMissingBases.add(hr.dir);
				warn(t("team.warn_base_not_found_in", { path: hr.path, base: hr.base }));
			}
			continue;
		}
		const wts = gitWorktrees(hr.dir).filter((w) => !w.main && w.branch);
		for (const w of wts) {
			const branch = w.branch as string;
			const info = branchInfo(hr.dir, hr.base, branch, w.path);
			const workspace = open.get(w.path);
			const a = findBranchAgent(branch, panes, running, hr.path, workspace);
			const screen = a?.name && a.agent_status !== "working" ? visibleScreen(a.name) : "";
			const question = a?.agent_status !== "blocked" ? questionIn(screen) : undefined;
			const notice = a?.agent_status === "blocked" && startupNoticeIn(screen);
			const status = notice ? "idle" : a?.agent_status;
			rows.push({
				...info,
				branch,
				path: w.path,
				workspace,
				agent: a ? { name: a.name, kind: a.agent, status, question, pane: a.pane_id, ...(notice ? { notice } : {}) } : undefined,
				state: classify({ agentStatus: question ? "blocked" : status, ...info }),
				managed: !!workspace || w.path.includes(herdrDir),
				repo: hr.path,
				base: hr.base,
			});
		}
	}
	return rows;
}

/** Color de cada estado (código SGR): amarillo si hay movimiento, rojo si te espera, verde si toca revisar. */
export const STATE_CODE: Record<State, string> = {
	trabajando: "33",
	bloqueado: "31",
	"sin commitear": "33",
	lista: "32",
	integrada: "2",
	"sin commits": "2",
};

const useColor = () => !!process.stdout.isTTY && !process.env.NO_COLOR;
export const paintState = (state: State, s: string, color = useColor()) => (color ? `\x1b[${STATE_CODE[state]}m${s}\x1b[0m` : s);
const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;

const STATE_DISPLAY: Record<State, "team.state_working" | "team.state_blocked" | "team.state_uncommitted" | "team.state_ready" | "team.state_integrated" | "team.state_no_commits"> = {
	trabajando: "team.state_working",
	bloqueado: "team.state_blocked",
	"sin commitear": "team.state_uncommitted",
	lista: "team.state_ready",
	integrada: "team.state_integrated",
	"sin commits": "team.state_no_commits",
};

function printStatus(rows: Row[]): void {
	if (!rows.length) return console.log(t("team.status_no_worktrees"));
	const isHub = rows.some((r) => r.repo !== undefined);
	const head = isHub
		? [
				t("team.status_th_repo"),
				t("team.status_th_branch"),
				t("team.status_th_state"),
				t("team.status_th_agent"),
				t("team.status_th_commits"),
				t("team.status_th_files"),
				t("team.status_th_where"),
			]
		: [
				t("team.status_th_branch"),
				t("team.status_th_state"),
				t("team.status_th_agent"),
				t("team.status_th_commits"),
				t("team.status_th_files"),
				t("team.status_th_where"),
			];
	const repoLabel = (r: Row) => {
		if (r.repo !== ".") return r.repo ?? "-";
		const h = hubRoot(r.path);
		const s = h ? catchDie(() => hubSession(h)).value : undefined;
		return s?.name ?? (h ? basename(h) : ".");
	};
	const table = rows.map((r) => {
		const stateDisplay = t(STATE_DISPLAY[r.state]);
		const questionDisplay = r.agent?.question ? `: ${r.agent.question}` : "";
		const dirtyDisplay = r.dirty && r.state !== "sin commitear" ? t("team.status_dirty_extra", { dirty: r.dirty }) : "";
		const whereDisplay = r.workspace ?? (r.agent?.pane ? t("team.status_panel", { pane: r.agent.pane }) : dim(t("team.status_closed")));
		const cols = [
			r.branch,
			stateDisplay + questionDisplay + dirtyDisplay,
			r.agent ? `${r.agent.name ?? "?"} (${r.agent.kind})` : "-",
			r.ahead ? `+${r.ahead}` : "-",
			r.files.length ? String(r.files.length) : "-",
			whereDisplay,
		];
		if (isHub) cols.unshift(repoLabel(r));
		return cols;
	});
	const w = head.map((h, i) => Math.max(h.length, ...table.map((t) => visible(t[i]))));
	const fmt = (t: string[]) => t.map((c, i) => (i === t.length - 1 ? c : c + " ".repeat(Math.max(0, w[i] - visible(c))))).join("  ");
	console.log(fmt(head));
	rows.forEach((r, i) => {
		const t = [...table[i]];
		const stateCol = isHub ? 2 : 1;
		t[stateCol] = paintState(r.state, t[stateCol]);
		console.log(fmt(t));
	});
	if (rows.some((r) => r.agent?.question)) {
		console.log(caution(t("team.status_answer_hint")));
		console.log(dim(t("team.status_pi_trust_hint")));
	}
}

function parseCommon(args: string[], flags: string[], valued: string[]): { positional: string[]; opts: Record<string, string | true> } {
	const positional: string[] = [];
	const opts: Record<string, string | true> = {};
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (valued.includes(a)) opts[a] = args[++i] ?? die(t("team.err_needs_value", { flag: a }));
		else if (flags.includes(a)) opts[a] = true;
		else if (a.startsWith("-")) die(t("team.err_unknown_opt", { opt: a }));
		else positional.push(a);
	}
	return { positional, opts };
}

function status(args: string[]): void | Promise<void> {
	const { positional, opts } = parseCommon(args, ["--json", "-j", "--watch", "-w", "--keep-open"], ["--base", "-b"]);
	if (positional.length > 1) die(t("team.err_status_usage"));
	const root = repoOf(positional[0]);
	const base = (opts["--base"] ?? opts["-b"]) as string | undefined;
	const hub = hubRoot(root);
	if (hub && base) die(t("team.err_hub_base_override"));
	if (opts["--watch"] || opts["-w"]) {
		if (opts["--json"] || opts["-j"]) die(t("team.err_watch_json_conflict"));
		const targetRoot = hub ?? root;
		const targetBase = hub ? "" : (base ?? defaultBase(root));
		return watch(targetRoot, targetBase, !!opts["--keep-open"]);
	}
	if (opts["--keep-open"]) die(t("team.err_keep_open_needs_watch"));
	const rows = sessionRows(root, base);
	if (opts["--json"] || opts["-j"]) return console.log(JSON.stringify(rows, null, 2));
	printStatus(rows);
}

// --- tabla en vivo -------------------------------------------------------------------------

/**
 * Columnas que ocupa `s` en el terminal: sin las secuencias de color, con los emoji y los
 * caracteres anchos a 2 y los que se combinan con el anterior (selectores de variante, ZWJ,
 * acentos sueltos) a 0. Un selector de emoji (U+FE0F) ensancha el carácter que lo precede.
 */
export function textWidth(s: string): number {
	let n = 0;
	let prev = 0;
	for (const ch of s.replace(/\x1b\[[0-9;]*m/g, "")) {
		if (ch === "\ufe0f") {
			n += 2 - prev;
			prev = 2;
		} else if (/[\u200d\ufe0e]|\p{M}/u.test(ch)) prev = 0;
		else n += prev = WIDE.test(ch) ? 2 : 1;
	}
	return n;
}
const WIDE = /\p{Emoji_Presentation}|[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u;

/** `s` recortado a `n` columnas, con … si no cabe. */
function clip(s: string, n: number): string {
	if (n <= 0) return "";
	if (textWidth(s) <= n) return s;
	let out = "";
	for (const ch of s) {
		if (textWidth(`${out}${ch}`) > n - 1) break;
		out += ch;
	}
	return `${out}…`;
}
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - textWidth(s)));

/** Grupos de la tabla en vivo, en el orden en que salen: primero lo que te espera. */
export const WATCH_GROUPS: Array<{ icon: string; title: string; states: State[] }> = [
	{ icon: "⛔", get title() { return t("team.watch_group_blocked"); }, states: ["bloqueado"] },
	{ icon: "🔄", get title() { return t("team.watch_group_working"); }, states: ["trabajando"] },
	{ icon: "✏️", get title() { return t("team.watch_group_uncommitted"); }, states: ["sin commitear"] },
	{ icon: "📦", get title() { return t("team.watch_group_ready"); }, states: ["lista"] },
	{ icon: "✅", get title() { return t("team.watch_group_integrated"); }, states: ["integrada", "sin commits"] },
];

/**
 * Las líneas de la tabla en vivo, recortadas a `width`: las ramas agrupadas por estado (sin los
 * grupos vacíos), cada grupo con su título —que lleva el icono del estado— y cada fila con el
 * minion, la rama, los commits y los ficheros; bajo una rama bloqueada, la pregunta que espera.
 */
export function renderWatch(rows: Row[], o: { width: number; color: boolean; repo: string; base?: string; branch?: string; hub?: boolean; time: string; notice?: string }): string[] {
	const dimmed = (s: string) => (o.color ? `\x1b[2m${s}\x1b[0m` : s);
	const isHub = !!o.hub || rows.some((r) => r.repo !== undefined);
	const branches = new Set(rows.map((r) => r.branch).filter(Boolean));
	const branch = o.branch ?? (branches.size > 0 ? [...branches].join(", ") : undefined);
	const title = isHub ? (branch ? `bond team · ${o.repo} · ${branch}` : `bond team · ${o.repo}`) : `bond team · ${o.repo} · base ${o.base}`;
	const out = [pad(clip(title, o.width - o.time.length - 1), o.width - o.time.length) + o.time];
	if (!rows.length) out.push("", clip(t("team.watch_no_worktrees"), o.width));
	else {
		const cells = rows.map((r) => [
			r.agent?.name ?? "-",
			(isHub ? (r.repo === "." ? o.repo : r.repo) : r.branch) ?? "-",
			r.ahead ? `+${r.ahead}` : "-",
			r.files.length ? String(r.files.length) : "-",
		]);
		const widths = (h: string[]) => h.map((x, i) => Math.max(textWidth(x), ...cells.map((c) => textWidth(c[i]))));
		const room = (w: number[]) => w.reduce((a, b) => a + b + 2, 0);
		// En un panel estrecho, cabeceras cortas y, si aun así no cabe, la rama recortada.
		let head = isHub
			? [t("team.watch_th_minion"), t("team.watch_th_repo"), t("team.watch_th_commits"), t("team.watch_th_files")]
			: [t("team.watch_th_minion"), t("team.watch_th_branch"), t("team.watch_th_commits"), t("team.watch_th_files")];
		let w = widths(head);
		if (room(w) > o.width)
			w = widths(
				(head = isHub
					? [t("team.watch_th_minion"), t("team.watch_th_repo"), t("team.watch_th_com"), t("team.watch_th_fich")]
					: [t("team.watch_th_minion"), t("team.watch_th_branch"), t("team.watch_th_com"), t("team.watch_th_fich")]),
			);
		w[1] = Math.max(4, w[1] - Math.max(0, room(w) - o.width));
		const fmt = (c: string[]) => c.map((x, i) => pad(clip(x, w[i]), w[i])).join("  ").trimEnd();
		out.push("", clip(fmt(head), o.width));
		for (const g of WATCH_GROUPS) {
			const group = rows.flatMap((r, i) => (g.states.includes(r.state) ? [[r, cells[i]] as const] : []));
			if (!group.length) continue;
			out.push("", paintState(group[0][0].state, clip(`${g.icon} ${g.title}`, o.width), o.color));
			for (const [r, c] of group) {
				out.push(paintState(r.state, clip(fmt(c), o.width), o.color));
				if (r.agent?.question) out.push(clip(t("team.watch_question", { question: r.agent.question }), o.width));
			}
		}
	}
	if (o.notice) out.push("", ...o.notice.split("\n").map((l) => clip(l, o.width)));
	out.push("", dimmed(clip(t("team.watch_footer"), o.width)));
	return out;
}

/** Estados con trabajo pendiente: mientras una rama esté en alguno, la tabla tiene algo que enseñar. */
const BUSY: State[] = ["trabajando", "bloqueado", "sin commitear", "lista"];

/**
 * ¿Le queda trabajo al equipo? Una rama en un estado con trabajo, o con su agente abierto y sin
 * commits aún (recién creada, le toca empezar). Integradas o sin agente, no. `worked`: ramas que
 * ya tuvieron commits; si vuelven a `sin commits`, es que se integraron por merge o fast-forward
 * (respaldo para cuando branchInfo no puede saberlo, sin reflog: con él ya salen `integrada`).
 */
export const pendingWork = (rows: Row[], worked: Set<string> = new Set()) => rows.some((r) => BUSY.includes(r.state) || (r.state === "sin commits" && !!r.agent && !worked.has(r.branch)));

/**
 * Qué hace la tabla en vivo en un refresco: `busy` si hay trabajo; si no, `close` cuando corre
 * en el panel de la tabla de ese repo, sin el foco y sin --keep-open, o `idle` (solo avisa).
 */
export function watchIdle(rows: Row[], pane: { label?: string; focused?: boolean } | undefined, repo: string, keepOpen: boolean, worked?: Set<string>): "busy" | "idle" | "close" {
	if (pendingWork(rows, worked)) return "busy";
	return !keepOpen && pane?.label === watchLabel(repo) && !pane.focused ? "close" : "idle";
}

/** Refrescos seguidos sin trabajo antes de cerrar el panel de la tabla (para que se vea el aviso). */
const CLOSE_TICKS = 3;

/**
 * `bond team status --watch`: la tabla en la pantalla alternativa, cada 2 s, hasta q o Ctrl+C.
 * En el panel de la tabla, sin trabajo pendiente, avisa y lo cierra (salvo enfocado o `keepOpen`).
 */
async function watch(root: string, base: string, keepOpen = false): Promise<void> {
	const out = process.stdout;
	const stdin = process.stdin;
	if (!out.isTTY) die(t("team.err_watch_needs_tty"));
	const hub = hubRoot(root);
	const session = hub ? hubSession(hub) : undefined;
	const targetRoot = hub ?? root;
	const repo = session ? session.name : basename(root);
	if (!session) teamRows(root, base); // Que una base que no existe falle aquí, fuera de la pantalla alternativa.
	else sessionRows(targetRoot);
	const color = !process.env.NO_COLOR;
	const self = insideHerdr() ? process.env.HERDR_PANE_ID : undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	/** Refrescos seguidos listos para cerrar, y si toca cerrar ya. */
	let idleTicks = 0;
	let closing = false;
	let notice: string | undefined;
	/** Ramas que han tenido commits mientras corre la tabla. */
	const worked = new Set<string>();
	const restore = () => {
		if (stopped) return;
		stopped = true;
		clearTimeout(timer);
		if (stdin.isTTY) stdin.setRawMode(false);
		stdin.pause();
		out.write("\x1b[?25h\x1b[?1049l");
	};
	/** `tick`: un refresco de los de cada 2 s (no el de cambiar el tamaño), que cuenta para cerrar. */
	const draw = (tick = false) => {
		let lines: string[];
		try {
			const rows = sessionRows(targetRoot);
			if (tick) {
				for (const r of rows) if (r.ahead) worked.add(r.branch);
				let pane: HerdrPane | undefined;
				if (self && !keepOpen && !pendingWork(rows, worked)) {
					try {
						pane = herdr<{ pane?: HerdrPane }>(["pane", "get", self]).pane;
					} catch {
						// Sin respuesta de Herdr: no se cierra.
					}
				}
				const next = watchIdle(rows, pane, repo, keepOpen, worked);
				idleTicks = next === "close" ? idleTicks + 1 : 0;
				closing = idleTicks >= CLOSE_TICKS;
				notice = next === "busy" ? undefined : next === "close" ? t("team.watch_closing_in", { seconds: (CLOSE_TICKS - idleTicks) * 2 }) : t("team.watch_no_pending_work");
			}
			// Sin la última columna: escribir en ella y borrar el resto de la línea se come esa letra.
			lines = renderWatch(rows, { width: (out.columns || 80) - 1, color, repo, base, time: new Date().toTimeString().slice(0, 8), notice, hub: !!session });
		} catch (e) {
			lines = [`bond team · ${repo}`, "", clip(t("team.watch_error", { error: (e as Error).message }), out.columns || 80)];
		}
		if (stopped) return;
		out.write(`\x1b[H${lines.slice(0, out.rows || lines.length).map((l) => `${l}\x1b[K`).join("\r\n")}\x1b[J`);
	};
	// Si algo termina el proceso a medias, el terminal no se queda en la pantalla alternativa.
	process.on("exit", restore);
	out.write("\x1b[?1049h\x1b[?25l\x1b[2J");
	await new Promise<void>((done) => {
		const redraw = () => draw();
		const quit = () => {
			restore();
			out.off("resize", redraw);
			for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.off(sig, quit);
			done();
		};
		if (stdin.isTTY) stdin.setRawMode(true);
		stdin.resume();
		stdin.on("data", (d) => {
			const s = d.toString();
			if (/[qQ\x03]/.test(s)) quit();
		});
		for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(sig, quit);
		out.on("resize", redraw);
		const tick = () => {
			draw(true);
			if (closing) {
				quit();
				// Cerrar el panel termina también este proceso.
				if (self) run("herdr", ["pane", "close", self]);
			} else if (!stopped) timer = setTimeout(tick, 2000);
		};
		tick();
	});
	process.off("exit", restore);
}

/** Título del panel de la tabla en vivo de un repo. */
export const watchLabel = (repo: string) => t("team.watch_pane_label", { repo });

/** Cómo volver a lanzar este bond: el binario, o node/bun con su script (desde el código o npm). */
export function selfCommand(execPath = process.execPath, script = process.argv[1]): string[] {
	return /^(node|bun)(\.exe)?$/i.test(basename(execPath)) && script ? [execPath, script] : [execPath];
}

const shellQuote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

/** La orden que muestra la tabla en vivo, lista para escribirla en la shell de un panel. */
export function watchCommand(root: string, base?: string, self = selfCommand()): string {
	const hub = hubRoot(root);
	const targetRoot = hub ?? root;
	return [...self, "team", "status", targetRoot, "--watch", ...(base && !hub ? ["--base", base] : [])].map(shellQuote).join(" ");
}

/** El panel de la tabla de ese repo en la pestaña, si ya está. */
export const findWatchPane = (panes: HerdrPane[], tab: string | undefined, repo: string) => panes.find((p) => p.tab_id === tab && p.label === watchLabel(repo))?.pane_id;

/** ¿Ese panel está mostrando ya la tabla? (si se salió con q, queda su shell) */
function watching(pane: string): boolean {
	try {
		const info = herdr<{ process_info?: { foreground_processes?: Array<{ argv?: string[] }> } }>(["pane", "process-info", "--pane", pane]).process_info;
		return (info?.foreground_processes ?? []).some((p) => p.argv?.includes("--watch") && p.argv.includes("status"));
	} catch {
		return false;
	}
}

/** Abre (o reutiliza) a la derecha del panel del que llama un panel estrecho con la tabla en vivo. */
export function openWatch(root: string, anchor: string, base?: string): void {
	const hub = hubRoot(root);
	const targetRoot = hub ?? root;
	const repo = basename(targetRoot);
	try {
		const me = herdr<{ pane?: HerdrPane }>(["pane", "get", anchor]).pane;
		const panes = herdr<{ panes?: HerdrPane[] }>(["pane", "list", ...(me?.workspace_id ? ["--workspace", me.workspace_id] : [])]).panes ?? [];
		let pane = findWatchPane(panes, me?.tab_id, repo);
		if (pane && watching(pane)) return console.log(`${ok("✓")} ${t("team.live_table")}  ${dim(t("team.table_already_open", { pane }))}`);
		if (!pane) {
			pane = herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", anchor, "--direction", "right", "--ratio", "0.6", "--cwd", targetRoot, "--no-focus"]).pane?.pane_id;
			if (!pane) throw new Error(t("team.err_herdr_pane_read"));
			run("herdr", ["pane", "rename", pane, watchLabel(repo)]);
		}
		herdr(["pane", "run", pane, watchCommand(targetRoot, base)]);
		console.log(`${ok("✓")} ${t("team.live_table")}  ${t("team.table_in_pane", { pane })}`);
	} catch (e) {
		warn(t("team.warn_table_failed", { error: (e as Error).message }));
	}
}

// --- mandar trabajo -------------------------------------------------------------------------

async function prompt(args: string[]): Promise<void> {
	requireHerdr();
	const { positional, opts } = parseCommon(args, ["--wait", "--no-record"], ["--timeout", "--repo"]);
	const [branch, ...words] = positional;
	if (!branch || !words.length) die(t("team.err_prompt_usage"));
	const root = repoOf();
	const extra = [...(opts["--wait"] ? ["--wait"] : []), ...(opts["--timeout"] ? ["--timeout", opts["--timeout"] as string] : [])];
	const session = hubOf(root);
	if (session) return promptInHub(session, branch, words.join(" "), opts, extra);
	if (opts["--repo"]) die(t("team.err_repo_only_hub"));
	const rows = teamRows(root);
	const row = rows.find((r) => r.branch === branch) ?? die(t("team.err_no_worktree_for_branch", { branch }));
	const name = row.agent?.name ?? die(t("team.err_no_agent_running", { branch }));
	// Con una pregunta en pantalla, el Enter del prompt la contestaría por ti y la tarea se perdería.
	if (row.state === "bloqueado") {
		const msg = row.agent?.question
			? t("team.err_agent_blocked_with_q", { name, question: row.agent.question, workspace: row.workspace ?? "" })
			: t("team.err_agent_blocked", { name, workspace: row.workspace ?? "" });
		die(msg);
	}
	// La memoria de decisiones: el encargo queda en el run antes de mandar, y si escribir
	// falla no puede cortar el envío (D9). Con memoria activa, el texto enviado lleva
	// además la nota de D18: las decisiones viajan con la rama.
	const ctx = runCtx(root, row);
	const task = ctx ? withMemoryNote(words.join(" "), ctx.dir) : words.join(" ");
	let runRel: string | undefined;
	if (ctx && !opts["--no-record"]) {
		try {
			runRel = recordRequest(ctx, task);
		} catch (e) {
			warn(t("team.warn_run_record_failed", { error: (e as Error).message }));
		}
	}
	// Herdr rechaza el prompt de un agente blocked: el aviso de arranque de agy se cierra con Esc.
	if (row.agent?.notice) run("herdr", ["agent", "send-keys", name, "esc"], { timeout: 5000 });
	const r = await promptAgent(name, task, extra);
	if (r.error !== undefined) die(`${name}: ${r.error}`);
	console.log(`${ok("✓")} ${branch} → ${name}${runRel ? `  ${dim(t("team.run_label", { rel: runRel }))}` : ""}${opts["--wait"] ? `  ${dim(r.status ?? "")}` : ""}`);
}

/** Espera `ms` milisegundos. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ¿El resultado de Herdr es un prompt estancado (no se observó actividad en la ventana)? */
function isStalled(r: { error?: string; code?: string }): boolean {
	return r.code === "agent_prompt_stalled" || (r.error ?? "").includes("agent_prompt_stalled");
}

/**
 * ¿El panel del agente muestra señales de haber recibido la tarea? Un stall no prueba que el
 * prompt no llegara, así que antes de reenviar se comprueba el panel: si ya se ve la tarea,
 * se da por entregado y no se reintenta.
 */
function paneShowsPrompt(name: string, task: string): boolean {
	try {
		const rd = run("herdr", ["agent", "read", name, "--source", "recent-unwrapped", "--lines", "120"], { timeout: 10_000 });
		if (rd.status !== 0) return false;
		const hay = rd.stdout.replace(/\s+/g, " ");
		const needle = task.split("\n")[0].trim().replace(/\s+/g, " ").slice(0, 60);
		return needle.length > 0 && hay.includes(needle);
	} catch {
		return false;
	}
}

/** Un envío de `herdr agent prompt`, sin la lógica de reintento. */
function rawPrompt(name: string, task: string, extra: string[]): Promise<{ status?: string; error?: string; code?: string }> {
	return new Promise((done) => {
		// Sin límite de tiempo propio: con --wait puede tardar lo que tarde el agente.
		const child = spawn("herdr", ["agent", "prompt", name, task, ...extra], { stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		let err = "";
		// Texto, no Buffers: un carácter UTF-8 partido entre dos trozos no se rompe.
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (d) => {
			out += d;
		});
		child.stderr.on("data", (d) => {
			err += d;
		});
		child.on("error", (e) => done({ error: e.message }));
		child.on("close", (code) => {
			let parsed: { result?: { agent?: { agent_status?: string } }; error?: { code?: string; message?: string } } = {};
			try {
				parsed = JSON.parse(out || err || "{}");
			} catch {
				// Salida no JSON.
			}
			if (code !== 0 || parsed.error) done({ error: parsed.error?.message ?? (err || out).trim(), code: parsed.error?.code });
			else done({ status: parsed.result?.agent?.agent_status });
		});
	});
}

/**
 * Enviar una tarea a un agente y esperar su primer estado asentado.
 *
 * Con `--wait` puede tardar lo que tarde el agente; si el agente queda blocked se devuelve tal
 * cual para que el orquestador decida (no se reintenta: un blocked es una decisión del agente).
 *
 * Si Herdr responde `agent_prompt_stalled` y el panel no muestra la tarea (p. ej. un agente
 * recién arrancado que aún no registró actividad), se espera un momento y se reintenta UNA
 * vez. Si vuelve a estancarse sin señales en el panel, se devuelve un error claro (stalled)
 * en lugar de un aviso: el prompt se perdió y hay que revisarlo. Si el panel ya muestra la
 * tarea, se da por entregada pese al stall y no se reenvía.
 */
async function promptAgent(name: string, task: string, extra: string[]): Promise<{ status?: string; error?: string; stalled?: boolean }> {
	const first = await rawPrompt(name, task, extra);
	if (!isStalled(first)) return first;
	if (paneShowsPrompt(name, task)) return { status: first.status ?? "idle" };
	await sleep(1500);
	const second = await rawPrompt(name, task, extra);
	if (!isStalled(second)) return second;
	if (paneShowsPrompt(name, task)) return { status: second.status ?? "idle" };
	return {
		stalled: true,
		error: t("team.err_prompt_stalled_pane", { name }),
	};
}

// --- runs: encargos e informes en la memoria de decisiones -----------------------------------
//
// Con [decisions] activo, cada encargo que se manda desde aquí queda en
// <dir>/runs/YYYY-MM-DD-<agente>-<slug>.md (D9), escrito por bond en el checkout principal:
// el texto exacto del encargo al mandar (prompt) y el informe leído del panel al recoger
// (collect), más los commits de la rama y las decisiones registradas por ese agente (D15).
// El agente de la rama nunca escribe su run: reporta en su respuesta y bond lo guarda aquí.

const utcNow = () => `${new Date().toISOString().slice(0, 19)}Z`;
const utcToday = () => new Date().toISOString().slice(0, 10);
const q = (s: string) => JSON.stringify(s);
const fmList = (k: string, xs: string[]) => (xs.length ? `${k}:\n${xs.map((x) => `  - ${q(x)}`).join("\n")}` : `${k}: []`);

export interface RunFm {
	agent: string;
	kind: string;
	branch: string;
	/** Base del run, `main@abc1234`: rama y commit desde el que salió el trabajo. */
	base: string;
	/** Quién mandó el encargo: `kind/nombre` en un panel de Herdr, `user` fuera. */
	orchestrator: string;
	started_at: string;
	finished_at: string;
	/** sent | reported | integrated | failed */
	status: string;
	commits: string[];
	decisions: string[];
}

export interface RunCtx {
	/** Checkout principal: donde se guardan los runs (nunca en el worktree del agente). */
	mainRoot: string;
	/** Worktree de la rama: de sus ficheros salen las decisiones del agente. */
	worktree: string;
	/** Carpeta de decisiones relativa ([decisions] dir), con `/`. */
	dir: string;
	/** Repo de la rama, si no es mainRoot: en un hub, el submódulo (los runs van al hub, D5). */
	repo?: string;
	/** Carpeta de decisiones del repo de la rama, si no es `dir`; "" si ese repo no tiene memoria. */
	agentDir?: string;
	branch: string;
	base: string;
	agent: string;
	kind: string;
	orchestrator: string;
}

const REPORT_HEADER = "## Report";

/**
 * Nota que bond añade al encargo con la memoria de decisiones activa (D18): las
 * decisiones viajan con la rama. Lo que el agente registra en <dir>/ debe commitearse en
 * su rama para que se integre y se revise con el código en el PR.
 */
export const withMemoryNote = (task: string, dir: string) =>
	`${task}\n\n[memoria de decisiones] Si registras decisiones con bond, commitea los ficheros de ${dir}/ en esta rama junto con tu trabajo: viajan con la rama y se revisan con el código. No escribas en el plan ni en ${dir}/runs/.`;

/**
 * Última respuesta de texto del asistente en una sesión .jsonl de pi (D17). Cada línea es
 * un evento JSON; los mensajes del asistente llevan bloques `thinking`/`text`/`toolCall`:
 * sale el texto de los bloques `text` del último mensaje con él, saltando los que solo
 * tienen razonamiento o llamadas a herramientas. Lee también el transcript de Claude Code y
 * el de agy (pasos PLANNER_RESPONSE con `content`). undefined si el fichero no se puede leer
 * o no hay ninguna respuesta con texto.
 */
export function lastAssistantText(file: string): string | undefined {
	let text: string;
	const full = file.endsWith("transcript.jsonl") ? file.replace(/transcript\.jsonl$/, "transcript_full.jsonl") : undefined;
	const target = full && existsSync(full) ? full : file;
	try {
		text = readFileSync(target, "utf8");
	} catch {
		return undefined;
	}
	let last: string | undefined;
	for (const line of text.split("\n")) {
		if (!line.includes('"assistant"') && !line.includes('"PLANNER_RESPONSE"')) continue;
		let e: { type?: string; source?: string; content?: unknown; message?: { role?: string; content?: unknown } };
		try {
			e = JSON.parse(line);
		} catch {
			continue;
		}
		// agy: transcript.jsonl con pasos; la respuesta es el content de un PLANNER_RESPONSE.
		if (e.type === "PLANNER_RESPONSE" && e.source === "MODEL") {
			if (typeof e.content === "string" && e.content.trim()) last = e.content.trim();
			continue;
		}
		// pi: type "message"; Claude Code: type "assistant". En los dos, message.role.
		if ((e.type !== "message" && e.type !== "assistant") || e.message?.role !== "assistant") continue;
		const parts = Array.isArray(e.message.content) ? (e.message.content as Array<{ type?: string; text?: unknown }>) : [];
		const txt = parts
			.filter((p) => p?.type === "text" && typeof p.text === "string" && (p.text as string).trim())
			.map((p) => (p.text as string).trim())
			.join("\n\n")
			.trim();
		if (txt) last = txt;
	}
	return last;
}

/** Línea del arranque de agy: el logo (▄▀, con la versión, la cuenta y la carpeta a la derecha), la bienvenida o el aviso de inicio de sesión. */
const isAgyBanner = (l: string) => /^[\s▄▀█]*[▄▀█][\s▄▀█]*(?: {2}.*)?$/.test(l) || /Welcome to the Antigravity CLI/.test(l) || /^\s*\S?\s*Signing in\.\.\./.test(l) || !l.trim();

/**
 * Recorta el volcado del panel de un agente (respaldo de D17): fuera el banner de arranque
 * de pi (arte ASCII, versión, «licence to code») o de agy (logo y bienvenida) y los avisos de
 * skills en conflicto, que no forman parte del informe. El volcado puede traer más cosas (eco del encargo, salidas de
 * herramientas): se quita lo que sabemos que no es respuesta y lo demás se guarda tal cual.
 */
export function trimAgentBanner(text: string): string {
	const lines = text.split("\n");
	let i = 0;
	while (i < lines.length && !lines[i].trim()) i++;
	// El logo de bond (bloques) cae en isAgyBanner; [╱╲] es el de antes de 1.11. Debajo, la línea
	// de comandos de la cabecera.
	while (i < lines.length && (/[╱╲]{3}/.test(lines[i]) || /\bpi v\d/.test(lines[i]) || /licence to code/i.test(lines[i]) || /^\s*\/delegate \/team\b/.test(lines[i]) || isAgyBanner(lines[i]))) i++;
	const kept: string[] = [];
	for (let j = i; j < lines.length; j++) {
		// Aviso de skills en conflicto: de la cabecera hasta el bloque en blanco que lo cierra
		// (el aviso trae dentro el fragmento de YAML señalado, con líneas sueltas).
		if (/^\s*\[Skill conflicts?\]/.test(lines[j])) {
			let blanks = 0;
			while (j < lines.length && blanks < 2) {
				if (lines[j].trim() === "") blanks++;
				j++;
			}
			j--; // el for externo vuelve a incrementar
			continue;
		}
		kept.push(lines[j]);
	}
	return kept.join("\n").trim();
}

/** Separador de agy: el que abre cada turno y los que enmarcan la caja de entrada. */
const isAgySep = (l: string) => /^─{20,}\s*$/.test(l);

/**
 * Recorta el volcado del panel de agy (respaldo de D17 sin su integración de Herdr): se queda
 * con la respuesta final del último turno. Cada turno abre con un separador y el encargo
 * repetido («> ...»); siguen el razonamiento y las herramientas en líneas con ○, ● o ▸ al
 * principio, y la respuesta, sangrada con dos espacios. Al final, la caja de entrada vacía y
 * la línea de atajos. Sin encargo a la vista, lo que hay tras el banner de arranque.
 */
export function trimAgyPane(text: string): string {
	const lines = text.split(/\r?\n/);
	let end = lines.length;
	for (let k = lines.length - 1; k > 0; k--) {
		if (/^>\s*$/.test(lines[k]) && isAgySep(lines[k - 1])) {
			end = k - 1;
			break;
		}
	}
	let start = -1;
	for (let k = end - 1; k >= 0; k--) {
		if (/^> \S/.test(lines[k])) {
			start = k;
			break;
		}
	}
	let tool = -1;
	for (let k = end - 1; k > start; k--) {
		if (/^[○●▸] /.test(lines[k])) {
			tool = k;
			break;
		}
	}
	const rest = tool >= 0 || start >= 0 ? lines.slice(Math.max(tool, start) + 1, end) : trimAgentBanner(lines.slice(0, end).join("\n")).split("\n");
	const body = rest.filter((l) => !isAgySep(l) && !/^\s*┃/.test(l));
	return body
		.map((l) => l.replace(/^ {2}/, ""))
		.join("\n")
		.trim();
}

/**
 * Fichero de sesión de un agente según lo que da Herdr: pi da la ruta; Claude Code, el id de la
 * sesión, cuyo transcript está en <config>/projects/<carpeta del proyecto>/<id>.jsonl; agy (con
 * la integración de Herdr), la ruta del transcript o el id de la conversación, cuyo transcript
 * está en ~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl.
 */
export function sessionFile(s?: { agent?: string; kind?: string; value?: string }, claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), agyDir = join(homedir(), ".gemini", "antigravity-cli")): string | undefined {
	if (!s?.value) return undefined;
	if (s.kind === "path") {
		if (s.value.endsWith("transcript.jsonl")) {
			const full = s.value.replace(/transcript\.jsonl$/, "transcript_full.jsonl");
			if (existsSync(full)) return full;
		}
		return s.value;
	}
	if (s.kind !== "id" || !/^[\w-]+$/.test(s.value)) return undefined;
	if (s.agent === "agy") {
		const full = join(agyDir, "brain", s.value, ".system_generated", "logs", "transcript_full.jsonl");
		if (existsSync(full)) return full;
		const f = join(agyDir, "brain", s.value, ".system_generated", "logs", "transcript.jsonl");
		return existsSync(f) ? f : undefined;
	}
	if (s.agent !== "claude") return undefined;
	const projects = join(claudeDir, "projects");
	let dirs: string[] = [];
	try {
		dirs = readdirSync(projects);
	} catch {
		return undefined;
	}
	return dirs.map((d) => join(projects, d, `${s.value}.jsonl`)).find((f) => existsSync(f));
}

/**
 * Informe de un agente (D17): primero su fichero de sesión (Herdr lo da en `agent_session`,
 * kind "path"; en pi un .jsonl) tomando solo su última respuesta; si no hay sesión legible
 * o sin texto, el volcado del panel recortado. Devuelve el texto y de dónde sale.
 */
export function agentReport(agent: string, paneRead: () => string, kind?: string): { report: string; source: "sesión" | "panel" } {
	try {
		const got = herdr<{ agent?: HerdrAgent }>(["agent", "get", agent], 10_000).agent;
		const sess = sessionFile(got?.agent_session);
		const fromSession = sess ? lastAssistantText(sess) : undefined;
		if (fromSession) return { report: fromSession, source: "sesión" };
	} catch {
		// Sin respuesta de Herdr o sin sesión: queda el panel.
	}
	return { report: kind === "agy" ? trimAgyPane(paneRead()) : trimAgentBanner(paneRead()), source: "panel" };
}

/** El fichero de un run: frontmatter D9 + secciones Request y Report. */
export function runFileText(fm: RunFm, request: string, report: string): string {
	return `---\nagent: ${q(fm.agent)}\nkind: ${q(fm.kind)}\nbranch: ${q(fm.branch)}\nbase: ${q(fm.base)}\norchestrator: ${q(fm.orchestrator)}\nstarted_at: ${q(fm.started_at)}\nfinished_at: ${q(fm.finished_at)}\nstatus: ${q(fm.status)}\n${fmList("commits", fm.commits)}\n${fmList("decisions", fm.decisions)}\n---\n\n## Request\n\n${request.trim()}\n\n${REPORT_HEADER}\n\n${report.trim()}\n`;
}

const fmOf = (p: Parsed): RunFm => ({
	agent: p.scalars.agent ?? "",
	kind: p.scalars.kind ?? "",
	branch: p.scalars.branch ?? "",
	base: p.scalars.base ?? "",
	orchestrator: p.scalars.orchestrator ?? "",
	started_at: p.scalars.started_at ?? "",
	finished_at: p.scalars.finished_at ?? "",
	status: p.scalars.status ?? "sent",
	commits: p.lists.commits ?? [],
	decisions: p.lists.decisions ?? [],
});

interface RunOnDisk {
	name: string;
	rel: string;
	fm: Parsed;
	request: string;
	report: string;
}

function readRun(name: string, rel: string, text: string): RunOnDisk | undefined {
	const p = parseFm(text);
	if (!p) return undefined;
	const ri = p.body.indexOf(REPORT_HEADER);
	const request = (ri < 0 ? p.body : p.body.slice(0, ri)).replace(/^\s*## Request\s*\n+/, "").trim();
	const report = ri < 0 ? "" : p.body.slice(ri + REPORT_HEADER.length).replace(/^\n+/, "").trim();
	return { name, rel, fm: p, request, report };
}

/** Los runs de <dir>/runs/, del más reciente al más antiguo (por started_at, y luego por nombre). */
export function loadRuns(root: string, dirRel: string): RunOnDisk[] {
	const dir = runsDirAbs(root, dirRel);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md") && f !== "README.md")
		.map((f) => readRun(f, `${dirRel}/runs/${f}`, readFileSync(join(dir, f), "utf8")))
		.filter((r): r is RunOnDisk => !!r)
		.sort((a, b) => {
			const sA = a.fm.scalars.started_at ?? "";
			const sB = b.fm.scalars.started_at ?? "";
			if (sA && sB && sA !== sB) return sB.localeCompare(sA);
			return b.name.localeCompare(a.name);
		});
}

export const runsDirAbs = (root: string, dirRel: string) => join(root, ...dirRel.split("/"), "runs");

/** Nombre libre del fichero de run: `<fecha>-<agente>-<slug>`, con sufijo `-2` si existe. */
function freeRunName(dir: string, ctx: RunCtx, describe: string): string {
	const cut = (s: string) => slugify(s).replace(/-+$/, "").slice(0, 40).replace(/-+$/, "");
	const stem = `${utcToday()}-${slugify(ctx.agent) || "agent"}-${cut(describe) || cut(ctx.branch) || "task"}`;
	for (let n = 1; ; n++) {
		const name = n === 1 ? `${stem}.md` : `${stem}-${n}.md`;
		if (!existsSync(join(dir, name))) return name;
	}
}

/**
 * Guarda un encargo: si el agente tiene un run abierto (status "sent") en esta rama, añade
 * el texto a su sección Request con la marca de tiempo; si no, crea el fichero nuevo.
 * Devuelve la ruta relativa del run.
 */
export function recordRequest(ctx: RunCtx, task: string, ts = utcNow()): string {
	const dir = runsDirAbs(ctx.mainRoot, ctx.dir);
	mkdirSync(dir, { recursive: true });
	const text = task.trim();
	if (!text) die(t("team.err_empty_task"));
	const open = loadRuns(ctx.mainRoot, ctx.dir).find((r) => r.fm.scalars.branch === ctx.branch && r.fm.scalars.agent === ctx.agent && r.fm.scalars.status === "sent");
	if (open) {
		const request = `${open.request}\n\n---\n\n**${ts}**\n\n${text}`;
		writeFileSync(join(dir, open.name), runFileText(fmOf(open.fm), request, open.report));
		return open.rel;
	}
	const name = freeRunName(dir, ctx, text);
	const fm: RunFm = { agent: ctx.agent, kind: ctx.kind, branch: ctx.branch, base: ctx.base, orchestrator: ctx.orchestrator, started_at: ts, finished_at: "", status: "sent", commits: [], decisions: [] };
	writeFileSync(join(dir, name), runFileText(fm, `**${ts}**\n\n${text}`, ""));
	return `${ctx.dir}/runs/${name}`;
}

/**
 * Recoge el informe de la rama: lo guarda en su run (lo crea si no hay, con `request` como
 * encargo, para delegaciones sin `bond team prompt`), con status "reported", finished_at,
 * los commits de la rama y las decisiones cuyo decided_by es este agente. Repetirlo
 * reemplaza el informe y recalcula las listas: no duplica nada.
 */
export function collectRun(ctx: RunCtx, report: string, o: { request?: string; ts?: string } = {}): { rel: string; commits: string[]; decisions: string[] } {
	const ts = o.ts ?? utcNow();
	const dir = runsDirAbs(ctx.mainRoot, ctx.dir);
	mkdirSync(dir, { recursive: true });
	const runs = loadRuns(ctx.mainRoot, ctx.dir).filter((r) => r.fm.scalars.branch === ctx.branch && (!ctx.agent || r.fm.scalars.agent === ctx.agent));
	const run_ = runs.find((r) => r.fm.scalars.status === "sent") ?? runs[0];
	// La base es la que se guardó al mandar el encargo, no la de ahora: si la rama ya se
	// integró, la base actual la contiene y no quedarían commits ni decisiones suyas.
	const at = run_?.fm.scalars.base ? { ...ctx, base: run_.fm.scalars.base } : ctx;
	const commits = branchCommits(at);
	const decisions = runDecisions(at);
	let name: string;
	let request: string;
	let fm: RunFm;
	if (run_) {
		name = run_.name;
		request = run_.request;
		fm = fmOf(run_.fm);
	} else {
		name = freeRunName(dir, ctx, o.request ?? ctx.branch);
		request = o.request?.trim() || "(encargo no registrado)";
		fm = { agent: ctx.agent, kind: ctx.kind, branch: ctx.branch, base: ctx.base, orchestrator: ctx.orchestrator, started_at: ts, finished_at: "", status: "sent", commits: [], decisions: [] };
	}
	fm.status = "reported";
	fm.finished_at = ts;
	fm.commits = commits;
	fm.decisions = decisions;
	writeFileSync(join(dir, name), runFileText(fm, request, report.trim()));
	return { rel: `${ctx.dir}/runs/${name}`, commits, decisions };
}

/** Commits de la rama respecto a la base del run, del más antiguo al más nuevo (`hash mensaje`). */
/**
 * Base del run para comparar: el commit guardado al mandar el encargo (`main@abc1234`) y, si
 * no lo hay, el nombre de la rama. El commit importa: tras integrar, la rama base ya contiene
 * el trabajo del agente y compararla con ella no dejaría ni commits ni decisiones.
 */
export const runBase = (base: string) => {
	const [ref, sha] = base.split("@");
	return sha || ref || "";
};

function branchCommits(ctx: RunCtx): string[] {
	const baseRef = runBase(ctx.base);
	if (!baseRef) return [];
	const r = git(ctx.repo ?? ctx.mainRoot, ["log", "--format=%h %s", `${baseRef}..${ctx.branch}`]);
	if (r.status !== 0) return [];
	return r.stdout.split("\n").filter(Boolean).reverse();
}

/**
 * Decisiones que este agente ha registrado en su rama (D15, D18): firmadas exactamente
 * `agent:<kind>/<nombre>` y que no estaban ya en la base. `agent:<kind>` a secas no vale: es
 * la firma de otro agente del mismo tipo sin nombre, como el orquestador.
 */
export function runDecisions(ctx: RunCtx): string[] {
	const dir = ctx.agentDir ?? ctx.dir;
	if (!ctx.kind || !dir) return [];
	const who = `agent:${ctx.kind}/${ctx.agent}`;
	const baseRef = runBase(ctx.base);
	const inBase = new Set(
		baseRef ? git(ctx.repo ?? ctx.mainRoot, ["ls-tree", "-r", "--name-only", baseRef, "--", dir]).stdout.split("\n").filter(Boolean) : [],
	);
	return loadDecisions(ctx.worktree, dir)
		.filter((d) => d.decided_by === who && !inBase.has(`${dir}/${d.id}.md`))
		.map((d) => d.id);
}

/** Enlace de la base actual: `main@abc1234`; cadena vacía si no se puede resolver. */
function baseLink(root: string, base?: string): string {
	try {
		const b = base ?? defaultBase(root);
		const short = git(root, ["rev-parse", "--short", b]).stdout.trim();
		return short ? `${b}@${short}` : b;
	} catch {
		return "";
	}
}

/**
 * Contexto de runs del repo y su rama, o undefined si el repo no usa la memoria de
 * decisiones (sin [decisions] o sin bond.toml). Con bond.toml inválido, también undefined:
 * prompt no puede quedarse parado por eso.
 */
function runCtx(root: string, row: Row): RunCtx | undefined {
	const main = gitWorktrees(root).find((w) => w.main)?.path ?? root;
	const { value: dec, error } = catchDie(() => repoDecisions(main));
	if (error !== undefined || !dec) return undefined;
	return {
		mainRoot: main,
		worktree: row.path,
		dir: dec.dir,
		branch: row.branch,
		base: baseLink(main),
		agent: row.agent?.name ?? row.agent?.kind ?? "",
		kind: row.agent?.kind ?? "",
		orchestrator: resolveAuthor().replace(/^agent:/, ""),
	};
}

/** Por qué no se puede recoger aún el informe de un agente con ese estado; undefined si se puede. */
export const collectBlocker = (status?: string) =>
	status === "working" ? t("team.blocker_working") : status === "blocked" ? t("team.blocker_blocked") : undefined;

function collect(args: string[]): void {
	requireHerdr();
	const { positional, opts } = parseCommon(args, [], ["--lines", "--agent", "--request", "--repo"]);
	const usage = t("team.err_collect_usage");
	const branch = positional[0] ?? die(usage);
	if (positional.length > 1) die(usage);
	const root = repoOf();
	const session = hubOf(root);
	if (session) return collectInHub(session, branch, opts);
	if (opts["--repo"]) die(t("team.err_repo_only_hub"));
	const main = gitWorktrees(root).find((w) => w.main)?.path ?? root;
	const { value: dec, error } = catchDie(() => repoDecisions(main));
	if (error !== undefined) die(t("team.err_read_decisions_failed", { path: main, error }));
	if (!dec) die(t("team.err_no_decision_memory"));
	const row = teamRows(root).find((r) => r.branch === branch);
	const agent = (opts["--agent"] as string | undefined) || row?.agent?.name || die(t("team.err_no_agent_for_collect", { branch }));
	const live = row?.agent ? undefined : agents(5000).find((a) => a.name === agent);
	const kind = row?.agent?.kind ?? live?.agent ?? "";
	const ctx: RunCtx = { mainRoot: main, worktree: row?.path ?? main, dir: dec.dir, branch, base: baseLink(main), agent, kind, orchestrator: resolveAuthor().replace(/^agent:/, "") };
	collectInto(ctx, row?.agent?.status ?? live?.agent_status, opts);
}

/** Lee el informe del agente de `ctx` y lo guarda en su run (collect, en un repo o en un hub). */
function collectInto(ctx: RunCtx, status: string | undefined, opts: Record<string, string | true>): void {
	const { agent, branch } = ctx;
	// Recoger a medias guardaría el panel sin terminar como informe y daría el run por acabado.
	const busy = collectBlocker(status);
	if (busy) {
		if (status === "working") die(t("team.err_agent_is_working", { agent }));
		else die(t("team.err_agent_is_blocked", { agent }));
	}
	const lines = String(opts["--lines"] ?? "200");
	// D17: el informe sale del fichero de sesión del agente; el panel recortado es el respaldo.
	const { report, source } = agentReport(agent, () => {
		const rd = run("herdr", ["agent", "read", agent, "--source", "recent-unwrapped", "--lines", lines], { timeout: 20_000 });
		if (rd.status !== 0) die(t("team.err_read_pane_failed", { agent, error: (rd.stderr || rd.stdout).trim() }));
		return rd.stdout;
	}, ctx.kind);
	const out = collectRun(ctx, report, { request: opts["--request"] as string | undefined });
	const sourceText = source === "sesión" ? t("team.collect_source_session") : t("team.collect_source_pane");
	const reportedText = t("team.collect_reported", {
		source: sourceText,
		commits: out.commits.length,
		branch,
		decisions: out.decisions.length,
		agent,
	});
	console.log(`${ok("~")} ${out.rel}  ${dim(reportedText)}`);
}

// --- quitar worktrees -----------------------------------------------------------------------

function clean(args: string[]): void {
	const { positional, opts } = parseCommon(args, ["--force", "--delete-branch", "--keep-table", "--dry-run"], ["--base", "-b", "--repo"]);
	const dir = positional.length && existsSync(positional[0]) ? positional.shift() : undefined;
	const root = repoOf(dir);
	const session = hubOf(root);
	if (session) return cleanInHub(session, positional, opts);
	if (opts["--repo"]) die(t("team.err_repo_only_hub"));
	const rows = teamRows(root, (opts["--base"] ?? opts["-b"]) as string | undefined);
	const unknown = positional.filter((b) => !rows.some((r) => r.branch === b));
	if (unknown.length) die(t("team.err_clean_no_worktree", { branches: unknown.join(", ") }));

	const targets = positional.length ? rows.filter((r) => positional.includes(r.branch)) : rows.filter((r) => r.state === "integrada" && r.managed);
	if (!positional.length) {
		const outside = rows.filter((r) => r.state === "integrada" && !r.managed);
		for (const r of outside) console.log(dim(t("team.clean_outside_herdr", { branch: r.branch, path: r.path })));
	}
	const removed = new Set<Row>();
	// Al acabar, sin agentes del equipo, la tabla en vivo sobra.
	const tableLeft = () => (opts["--keep-table"] ? undefined : closeIdleTable(root, rows.filter((r) => !removed.has(r))));
	if (!targets.length) {
		console.log(positional.length ? t("team.clean_nothing_to_remove") : t("team.clean_no_integrated_to_remove"));
		return tableLeft();
	}

	const gone = removeWorktrees(root, targets, opts);
	for (const r of gone) removed.add(r);
	if (!isDryRun()) git(root, ["worktree", "prune"]);
	tableLeft();
	if (![...gone].some((r) => r.workspace)) return;

	// El workspace del repo que abrió bond team para colgar los worktrees: se avisa, no se cierra.
	if (serverRunning() && !rows.some((r) => r.workspace && !targets.includes(r))) {
		const name = basename(root);
		const ws = workspaces().find((w) => w.label === `bond:${name}` || w.label === `pi:${name}`);
		if (ws) console.log(dim(t("team.clean_repo_ws_open", { label: ws.label ?? "", id: ws.workspace_id })));
	}
}

/**
 * Quita los worktrees de `targets` (del repo `root`): carpeta, workspace o panel y agente; con
 * --delete-branch, además las ramas integradas. Se salta, avisando, los que tienen el agente
 * trabajando o cambios sin commitear (salvo --force). Devuelve los que quitó. En un hub, `sub`
 * nombra el submódulo en la salida.
 */
function removeWorktrees(root: string, targets: Row[], opts: Record<string, string | true>, sub?: string): Set<Row> {
	const force = !!opts["--force"];
	const removed = new Set<Row>();
	const cwd = canonical(process.cwd());
	for (const r of targets) {
		const label = itemLabel({ branch: r.branch, sub });
		if (!force) {
			if (r.state === "trabajando") {
				warn(t("team.warn_clean_working", { label }));
				continue;
			}
			if (r.state === "sin commitear" || r.dirty) {
				warn(t("team.warn_clean_dirty", { label, dirty: r.dirty }));
				continue;
			}
			if (within(cwd, r.path)) {
				warn(t("team.warn_clean_inside", { label }));
				continue;
			}
			if (r.state === "bloqueado") {
				warn(t("team.warn_clean_blocked", { label }));
				continue;
			}
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
			warn(`${label}: ${(e as Error).message}`);
			continue;
		}
		removed.add(r);
		let branchNote = t("team.clean_branch_kept");
		if (opts["--delete-branch"]) {
			if (r.integrated || force) {
				act(`git branch -D ${r.branch}`, () => {
					const g = git(root, ["branch", "-D", r.branch]);
					if (g.status !== 0) throw new Error(g.stderr.trim());
				});
				branchNote = t("team.clean_branch_deleted");
			} else branchNote = t("team.clean_branch_not_integrated");
		}
		console.log(`${ok("-")} ${label}  ${dim(`${r.path} · ${branchNote}`)}`);
	}
	return removed;
}

/**
 * Paneles de la tabla en vivo de ese repo que ya no tienen nada que enseñar: si ninguna de las
 * ramas que quedan tiene su agente abierto, todos los `tabla · <repo>` del servidor, salvo el del
 * que llama.
 */
export function idleTables(left: Row[], panes: HerdrPane[], repo: string, self?: string): string[] {
	if (left.some((r) => r.agent)) return [];
	return panes.filter((p) => p.label === watchLabel(repo) && p.pane_id !== self).map((p) => p.pane_id);
}

/** Cierra el panel de la tabla en vivo si no queda ningún agente del equipo (bond team clean). */
function closeIdleTable(root: string, left: Row[]): void {
	if (!serverRunning()) return;
	let panes: HerdrPane[];
	try {
		panes = herdr<{ panes?: HerdrPane[] }>(["pane", "list"]).panes ?? [];
	} catch {
		return;
	}
	const hub = hubRoot(root);
	const repo = hub ? basename(hub) : basename(root);
	const remaining = hub ? sessionRows(hub) : left;
	for (const pane of idleTables(remaining, panes, repo, insideHerdr() ? process.env.HERDR_PANE_ID : undefined)) {
		try {
			act(`herdr pane close ${pane}`, () => herdr(["pane", "close", pane]));
			console.log(`${ok("-")} ${t("team.live_table")}  ${dim(t("team.clean_table_closed", { pane }))}`);
		} catch (e) {
			warn(t("team.warn_table_failed_short", { error: (e as Error).message }));
		}
	}
}

// --- equipo vertical en un hub -------------------------------------------------------------
//
// En un hub (declarado en hub.toml), una rama vertical se llama igual en
// todos los repos que toca (D1). En el hub es solo una rama (D3, D7); en cada repo, un
// worktree y un agente (D2). Una sola rama vertical por sesión (D10). Desde un repo de la sesión,
// bond team trabaja solo en ese repo, como siempre.

export { warnedInvalidHub };

/**
 * La sesión si `root` es un hub; undefined si no (un repo normal o un submódulo). Un hub.toml
 * inválido se avisa aquí y bond team sigue como en un repo normal.
 */
function hubOf(root: string): HubSession | undefined {
	const r = catchDie(() => hubSession(root));
	if (r.error !== undefined && !warnedInvalidHub.has(root)) {
		warnedInvalidHub.add(root);
		warn(t("team.warn_hub_fallback", { error: r.error }));
	}
	return r.value;
}

/** Los repos de la sesión donde trabajan los agentes: los que están en disco. */
const subRepos = (s: HubSession) => s.repos.filter((r) => r.path !== "." && r.present);

/** Los repos nombrados (por ruta o, si no se repite, por nombre de carpeta); sin nombres, todos. */
export function pickRepos(repos: HubRepo[], names: string[] | undefined, flag: string): HubRepo[] {
	if (!names) return repos;
	const out: HubRepo[] = [];
	for (const n of names) {
		const key = n.replace(/\\/g, "/").replace(/\/+$/, "");
		const exact = repos.filter((r) => r.path === key);
		const hits = exact.length ? exact : repos.filter((r) => basename(r.path) === key);
		if (!hits.length) die(t("team.err_pick_not_in_session", { flag, name: n, repos: repos.map((r) => r.path).join(", ") }));
		if (hits.length > 1) die(t("team.err_pick_multiple_hits", { flag, name: n, hits: hits.map((r) => r.path).join(", ") }));
		if (!out.includes(hits[0])) out.push(hits[0]);
	}
	return out;
}

/**
 * Ramas verticales abiertas en la sesión: las que tienen worktree en algún repo y existen
 * también en el hub (bond team las crea en los dos; clean quita los worktrees y deja las ramas).
 * Las bases de la sesión (la del hub y la de cada repo) no cuentan: un worktree suelto en
 * main o en release/1.0 no es una rama vertical. Cada una, con la carpeta de un worktree suyo.
 */
export function openVerticals(s: HubSession): Array<{ branch: string; repo: string; path: string }> {
	const bases = new Set(s.repos.map((r) => r.base));
	const inHub = (b: string) => git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]).status === 0;
	const open = new Map<string, { branch: string; repo: string; path: string }>();
	for (const r of subRepos(s)) {
		for (const w of gitWorktrees(r.dir)) if (!w.main && w.branch && !bases.has(w.branch) && !open.has(w.branch) && inHub(w.branch)) open.set(w.branch, { branch: w.branch, repo: r.path, path: w.path });
	}
	return [...open.values()].sort((a, b) => a.branch.localeCompare(b.branch));
}

/** Las filas de la sesión (sessionRows, cada una con su `repo`) que son de esos repos. */
const subRows = (s: HubSession, repos: HubRepo[]) => sessionRows(s.root).filter((row) => repos.some((r) => r.path === row.repo));

/** El repo de hub.toml de una fila de subRows. */
const repoOfRow = (s: HubSession, row: Row) => subRepos(s).find((r) => r.path === row.repo) as HubRepo;

async function createInHub(s: HubSession, o: TeamArgs): Promise<void> {
	if (o.specs.length > 1) die(t("team.err_hub_single_branch", { branches: o.specs.map((x) => x.branch).join(" ") }));
	if (o.base) die(t("team.err_hub_no_base"));
	const { branch, agent: asked } = o.specs[0];
	if (git(s.root, ["check-ref-format", "--branch", branch]).status !== 0) die(t("team.err_invalid_branch_name", { branches: JSON.stringify(branch) }));
	const subs = subRepos(s);
	if (!subs.length) die(t("team.err_hub_no_repos", { name: s.name }));
	const targets = pickRepos(subs, o.repos, "--repos");
	const open = openVerticals(s).filter((v) => v.branch !== branch);
	if (open.length) {
		const openStr = open.map((v) => t("team.hub_open_vertical_item", { branch: v.branch, repo: v.repo, path: v.path })).join(", ");
		die(t("team.err_hub_already_open", { name: s.name, open: openStr, branch: open[0].branch }));
	}
	const noBase = [s.repos[0], ...targets].filter((r) => git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status !== 0);
	if (noBase.length) die(t("team.err_hub_base_missing", { repos: noBase.map((r) => `${r.path === "." ? s.name : r.path} (${r.base})`).join(", ") }));

	// El agente de cada repo: el de rama:agente, si no --agent, si no el de su bond.toml.
	const plan: PlanItem[] = [];
	const { loadRepoAgents } = await import("./repo.mts");
	for (const r of targets) {
		const own = existsSync(join(r.dir, ".bond", "bond.toml")) ? catchDie(() => loadRepoAgents(r.dir)).value : undefined;
		const agent = await chooseAgent(asked ?? o.agent, own?.default_agent);
		if (own && !own.agents.includes(agent)) warn(t("team.warn_hub_foreign_agent", { path: r.path, agent }));
		if (git(r.dir, ["status", "--porcelain"]).stdout.trim()) warn(t("team.warn_hub_uncommitted", { path: r.path }));
		plan.push({ branch, agent, root: r.dir, sub: r.path, base: r.base });
	}

	// En el hub, la rama vertical es solo una rama: sin worktree ni agente (D7).
	if (git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0) console.log(`${ok("✓")} ${branch} · ${s.name}  ${dim(t("team.hub_branch_exists"))}`);
	else {
		const g = git(s.root, ["branch", branch, s.repos[0].base]);
		if (g.status !== 0) die(t("team.err_hub_git_branch", { name: s.name, branch, base: s.repos[0].base, error: g.stderr.trim() }));
		console.log(`${ok("✓")} ${branch} · ${s.name}  ${dim(t("team.hub_branch_created", { base: s.repos[0].base }))}`);
	}

	if (!insideHerdr()) await ensureServer();
	const anchor = insideHerdr() ? process.env.HERDR_PANE_ID : undefined;
	if (anchor) {
		const tab = callerTab(s.root, anchor);
		const pending = pendingInTab(s.root, plan);
		let layout = o.layout ?? "tabs";
		if (!o.layout && pending.todo.length > tab.room && !o.yes && process.stdin.isTTY && process.stdout.isTTY) layout = await askLayout(pending.todo.length, tab.room, s.name);
		if (layout === "workspaces") openWorkspaces(s.root, plan, o);
		else openInTab(s.root, anchor, tab, layout === "same-tab" ? Number.POSITIVE_INFINITY : tab.room, pending, o);
		openWatch(s.root, anchor);
	} else openWorkspaces(s.root, plan, o);
	const { renderSmall } = await import("../lib/bond-logo.mts");
	console.log(`\n  ${renderSmall(60, t("team.logo_branch_in_hub", { branch, name: s.name }))}\n`);
	printStatus(subRows(s, targets).filter((r) => r.branch === branch));
	console.log(dim(t("team.hub_footer_hints", { branch })));
}

/**
 * Nota de coordinación que lleva cada encargo de una rama vertical (D8): en qué repo trabaja
 * quien lo recibe y quiénes son los demás agentes de la rama, con su repo y su carpeta.
 */
export function verticalNote(hub: string, branch: string, me: { name: string; repo: string }, team: Array<{ name: string; repo: string; path: string }>): string {
	const others = team.filter((t) => t.name !== me.name);
	const head = `[equipo vertical] Trabajas en ${me.repo}, en la rama ${branch} del hub ${hub}; commitea solo en ese repo.`;
	if (!others.length) return `${head} Eres el único agente de la rama.`;
	return `${head} En la misma rama: ${others.map((o) => `${o.name} en ${o.repo} (${o.path})`).join("; ")}. Lo que cruce de un repo a otro (contratos, API, tipos) tiene que encajar con lo suyo: dilo en tu informe.`;
}

/**
 * Contexto de runs de una rama de un submódulo (D5): los runs van a la memoria del hub y, si el
 * hub no la tiene, a la del submódulo; los commits y las decisiones del agente salen del
 * submódulo. undefined si ni el hub ni el submódulo usan la memoria de decisiones.
 */
function hubRunCtx(s: HubSession, repo: HubRepo, row: Row, agent = row.agent?.name ?? row.agent?.kind ?? "", kind = row.agent?.kind ?? ""): RunCtx | undefined {
	const own = catchDie(() => repoDecisions(repo.dir)).value;
	const hub = catchDie(() => repoDecisions(s.root)).value;
	const store = hub ? { root: s.root, dir: hub.dir } : own ? { root: repo.dir, dir: own.dir } : undefined;
	if (!store) return undefined;
	return {
		mainRoot: store.root,
		dir: store.dir,
		repo: repo.dir,
		agentDir: own?.dir ?? "",
		worktree: row.path,
		branch: row.branch,
		base: baseLink(repo.dir, repo.base),
		agent,
		kind,
		orchestrator: resolveAuthor().replace(/^agent:/, ""),
	};
}

/** bond team prompt en un hub: la tarea a todos los agentes de la rama (o al de --repo), con la nota de D8. */
async function promptInHub(s: HubSession, branch: string, words: string, opts: Record<string, string | true>, extra: string[]): Promise<void> {
	const all = subRows(s, subRepos(s)).filter((r) => r.branch === branch);
	if (!all.length) die(t("team.err_hub_no_worktree", { branch, name: s.name }));
	const only = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo")[0] : undefined;
	const targets = only ? all.filter((r) => r.repo === only.path) : all;
	if (!targets.length) die(t("team.err_hub_no_worktree_in_repo", { branch, path: only?.path ?? "" }));
	for (const r of targets) if (!r.agent?.name) warn(t("team.warn_hub_no_agent", { repo: r.repo ?? "", branch }));
	const live = targets.filter((r) => r.agent?.name);
	if (!live.length) {
		if (only) die(t("team.err_hub_no_live_agent_in", { branch, path: only.path }));
		else die(t("team.err_hub_no_live_agent", { branch }));
	}
	// Con una pregunta en pantalla, el Enter del prompt la contestaría por ti: no se manda a nadie.
	const blocked = live.filter((r) => r.state === "bloqueado");
	if (blocked.length) die(t("team.err_hub_blocked_reply", { agents: blocked.map((r) => `${r.agent?.name} (${r.repo})${r.agent?.question ? `: ${r.agent.question}` : ""}`).join(", ") }));
	const team = all.filter((r) => r.agent?.name).map((r) => ({ name: r.agent?.name as string, repo: r.repo as string, path: r.path }));
	const sent = await Promise.all(
		live.map(async (row) => {
			const name = row.agent?.name as string;
			const ctx = hubRunCtx(s, repoOfRow(s, row), row);
			let task = `${words}\n\n${verticalNote(s.name, branch, { name, repo: row.repo as string }, team)}`;
			if (ctx?.agentDir) task = withMemoryNote(task, ctx.agentDir);
			let runRel: string | undefined;
			if (ctx && !opts["--no-record"]) {
				try {
					runRel = recordRequest(ctx, task);
				} catch (e) {
					warn(t("team.warn_hub_run_failed", { repo: row.repo ?? "", error: (e as Error).message }));
				}
			}
			if (row.agent?.notice) run("herdr", ["agent", "send-keys", name, "esc"], { timeout: 5000 });
			return { row, name, runRel, r: await promptAgent(name, task, extra) };
		}),
	);
	for (const { row, name, runRel, r } of sent) {
		if (r.stalled) continue; // se reportan todos juntos al final, con un error claro
		if (r.error !== undefined) {
			warn(`${row.repo}: ${name}: ${r.error}`);
			process.exitCode = 1;
		} else console.log(`${ok("✓")} ${branch} · ${row.repo} → ${name}${runRel ? `  ${dim(t("team.run_label", { rel: runRel }))}` : ""}${opts["--wait"] ? `  ${dim(r.status ?? "")}` : ""}`);
	}
	const stalls = sent.filter((x) => x.r.stalled);
	if (stalls.length) die(t("team.err_hub_prompt_stalls", { targets: stalls.map((x) => `${x.name} (${x.row.repo})`).join(", ") }));
}

/** bond team collect en un hub: el informe del agente de la rama en su repo (--repo si hay varios). */
function collectInHub(s: HubSession, branch: string, opts: Record<string, string | true>): void {
	const repos = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo") : subRepos(s);
	const asked = opts["--agent"] as string | undefined;
	let found = subRows(s, repos).filter((r) => r.branch === branch);
	// --agent: el de ese nombre en la rama o, como fuera de un hub, el worktree sin agente en marcha.
	if (asked) found = found.some((r) => r.agent?.name === asked) ? found.filter((r) => r.agent?.name === asked) : found.filter((r) => !r.agent);
	if (!found.length) {
		if (asked && opts["--repo"]) die(t("team.err_hub_no_wt_asked_repo", { branch, agent: asked, path: repos[0].path }));
		else if (asked) die(t("team.err_hub_no_wt_asked_all", { branch, agent: asked, name: s.name }));
		else if (opts["--repo"]) die(t("team.err_hub_no_wt_repo", { branch, path: repos[0].path }));
		else die(t("team.err_hub_no_wt_all", { branch, name: s.name }));
	}
	if (found.length > 1) die(t("team.err_hub_collect_multiple", { branch, count: found.length, repos: found.map((r) => r.repo).join(", ") }));
	const [row] = found;
	const repo = repoOfRow(s, row);
	const agent = asked || row.agent?.name || die(t("team.err_hub_no_agent_for_collect", { branch, path: repo.path }));
	const live = row.agent ? undefined : agents(5000).find((a) => a.name === agent);
	const ctx = hubRunCtx(s, repo, row, agent, row.agent?.kind ?? live?.agent ?? "") ?? die(t("team.err_hub_no_decision_memory", { hub: s.name, repo: repo.path }));
	collectInto(ctx, row.agent?.status ?? live?.agent_status, opts);
}

/** bond team clean en un hub: los worktrees de la rama en todos los repos de la sesión (o en el de --repo). */
function cleanInHub(s: HubSession, branches: string[], opts: Record<string, string | true>): void {
	if (opts["--base"] ?? opts["-b"]) die(t("team.err_hub_clean_no_base"));
	const repos = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo") : subRepos(s);
	const rows = subRows(s, repos);
	const unknown = branches.filter((b) => !rows.some((r) => r.branch === b));
	if (unknown.length) die(t("team.err_hub_clean_no_worktree", { target: opts["--repo"] ? repos[0].path : s.name, branches: unknown.join(", ") }));
	const targets = branches.length ? rows.filter((r) => branches.includes(r.branch)) : rows.filter((r) => r.state === "integrada" && r.managed);
	if (!branches.length) for (const r of rows.filter((y) => y.state === "integrada" && !y.managed)) console.log(dim(t("team.clean_outside_herdr", { branch: itemLabel({ branch: r.branch, sub: r.repo }), path: r.path })));
	const removed = new Set<Row>();
	if (!targets.length) console.log(branches.length ? t("team.clean_nothing_to_remove") : t("team.clean_no_integrated_to_remove"));
	for (const repo of repos) {
		const mine = targets.filter((r) => r.repo === repo.path);
		if (!mine.length) continue;
		for (const r of removeWorktrees(repo.dir, mine, opts, repo.path)) removed.add(r);
		if (!isDryRun()) git(repo.dir, ["worktree", "prune"]);
	}
	// La carpeta del hub en ~/.herdr/worktrees, si se queda vacía.
	const hubDir = join(homedir(), ".herdr", "worktrees", s.name);
	if (!isDryRun() && removed.size && existsSync(hubDir) && readdirSync(hubDir).length === 0) rmdirSync(hubDir);
	if (removed.size) cleanHubBranches(s, removed, opts);
	if (!opts["--keep-table"]) closeIdleTable(s.root, rows.filter((r) => !removed.has(r)));
}

/**
 * La rama del hub de las ramas verticales que se han quitado (D7: no tiene worktree). Sin
 * --delete-branch se queda; con él, se borra si ya está en la base del hub (o con --force) y no
 * le queda worktree en ningún repo.
 */
function cleanHubBranches(s: HubSession, removed: Set<Row>, opts: Record<string, string | true>): void {
	if (!opts["--delete-branch"]) return console.log(dim(t("team.hub_clean_branches_kept", { name: s.name })));
	const hubBase = s.repos[0].base;
	for (const branch of [...new Set([...removed].map((r) => r.branch))]) {
		if (git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status !== 0) continue;
		const label = itemLabel({ branch, sub: s.name });
		// En todos los repos de la sesión, no solo en el de --repo.
		const gone = new Set([...removed].map((r) => r.path));
		if (subRepos(s).some((r) => gitWorktrees(r.dir).some((w) => !w.main && w.branch === branch && !gone.has(w.path)))) {
			console.log(`${ok("-")} ${label}  ${dim(t("team.hub_clean_branch_kept_sub_wt"))}`);
			continue;
		}
		if (!branchInfo(s.root, hubBase, branch).integrated && !opts["--force"]) {
			console.log(`${ok("-")} ${label}  ${dim(t("team.hub_clean_branch_not_integrated", { base: hubBase }))}`);
			continue;
		}
		try {
			act(`git -C ${s.root} branch -D ${branch}`, () => {
				const g = git(s.root, ["branch", "-D", branch]);
				if (g.status !== 0) throw new Error(g.stderr.trim());
			});
			console.log(`${ok("-")} ${label}  ${dim(t("team.clean_branch_deleted"))}`);
		} catch (e) {
			warn(`${label}: ${(e as Error).message}`);
		}
	}
}

// --- entrada --------------------------------------------------------------------------------

/** `bond team`: crear el equipo, o sus subcomandos (status, prompt, clean). */
export async function team(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	if (sub === "status") return status(rest);
	if (sub === "prompt") return prompt(rest);
	if (sub === "collect") return collect(rest);
	if (sub === "clean") return clean(rest);
	return create(args);
}
