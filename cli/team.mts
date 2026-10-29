// `bond team`: un agente por rama, cada uno en su worktree, y lo que viene después: ver cómo va
// cada rama (status), mandar trabajo a la de una rama (prompt) y quitar los worktrees que ya no
// hacen falta (clean). Las ramas no se tocan: nada de merge, push ni borrado sin pedirlo.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { loadDecisions, parseFm, type Parsed, resolveAuthor, slugify } from "./decisions.mts";
import { type HubRepo, type HubSession, hubRoot, hubSession } from "./hub.mts";
import { chooseAgent, gitRoot, openWorkspace } from "./launch.mts";
import { agents, defaultAgentArgs, ensureServer, firstFreeName, herdr, type HerdrAgent, insideHerdr, preparePane, questionIn, requireHerdr, serverRunning, startedBlocked, startupNoticeIn, visibleScreen, workspaces } from "./herdr.mts";
import { repoDecisions } from "./repo.mts";
import { inheritTrust, TRUST_KINDS, trusts } from "./trust.mts";
import { act, canonical, caution, catchDie, die, dim, isDryRun, ok, run, warn } from "./util.mts";

export const TEAM_HELP = `Uso: bond team [repo] <rama[:agente]>... [opciones] [-- argumentos de los agentes]
       bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]
       bond team prompt <rama> <tarea> [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]
       bond team collect <rama> [--repo <repo>] [--lines <n>] [--agent <nombre>] [--request <encargo>]
       bond team clean [repo] [rama...] [--repo <repo>] [--base <ref>] [--force] [--delete-branch] [--keep-table] [--dry-run]

Abre un worktree y un agente por rama. Sin [repo], el repo del directorio actual. El agente de
cada rama: el de rama:agente, si no --agent, si no el agente por defecto del repo
(.bond/bond.toml), si no el de bond setup. Los worktrees salen de lo commiteado.

Dentro de Herdr, cada agente va en un panel de tu pestaña, debajo del tuyo (en fila, con el
mismo ancho), con nombre de minion (kevin, stuart, bob...). Tu pestaña admite 6 paneles: el
tuyo, la tabla y 4 minions; los que no caben van a pestañas nuevas "equipo · <repo>", 4 por
pestaña. Si no caben, bond team pregunta antes de crear nada: 1) pestañas nuevas (por
defecto), 2) todo en tu pestaña (filas de 4, aunque se apriete) o 3) un workspace por rama.
--tabs, --same-tab y --workspaces eligen sin preguntar; sin terminal o con --yes, la 1. Fuera
de Herdr, un workspace por rama. Dentro, además, un panel estrecho a la derecha del tuyo con la
tabla en vivo de todas las ramas (bond team status --watch), o el que ya haya.

En paneles, si el orquestador (pi, Claude Code o agy en el panel desde el que lanzas el equipo)
confía en el checkout principal, todos los agentes del equipo confían en su worktree; si no, cada
uno hereda la confianza que él mismo tenga en el checkout. bond la escribe en trust.json de pi,
~/.claude.json o trustedWorkspaces de agy, y el agente arranca sin preguntar; sin ninguna, o con
otros agentes, pregunta como siempre.

agy arranca con --dangerously-skip-permissions (sin él pide permiso por cada comando); tus
argumentos tras -- lo sustituyen. Si no está en el PATH pero sí en ~/.local/bin, bond añade esa
carpeta al PATH de la shell del panel antes de lanzarlo.

  -a, --agent <agente>   Agente para las ramas sin :agente
  -b, --base <ref>       Ref de la que salen las ramas nuevas
  --tabs                 Si no caben en tu pestaña, el resto en pestañas nuevas (por defecto)
  --same-tab             Todos en tu pestaña, en filas de 4, aunque no quepan
  --workspaces           Un workspace por rama (herdr worktree) en vez de paneles
  -y, --yes              Sin preguntar: si no caben, pestañas nuevas
  --no-trust             En paneles: no heredar la confianza del checkout principal
  --trust-repository     Con --workspaces: se pasa a herdr worktree (solo en repos revisados)
  --repos <a,b>          En un hub: solo esos repos de la sesión (ruta o nombre)

En un hub (un repo con [hub] en .bond/bond.toml, la escribe bond hub), bond team <rama> abre
una rama vertical: la crea en el hub, sin worktree ni agente, y abre un worktree y un agente
en cada submódulo de la sesión (o en los de --repos), cada uno desde su base de [hub] y con
el agente por defecto de su bond.toml (o el de rama:agente o --agent). En paneles, los
worktrees van en ~/.herdr/worktrees/<hub>/<submódulo>/<rama>. Una sola rama vertical por
sesión: con una abierta, bond team se niega a abrir otra hasta bond team clean. Desde el hub,
prompt manda la tarea a todos los agentes de la rama, con una nota que les dice quiénes son
los otros y en qué repo está cada uno (--repo, solo a uno); collect y clean buscan la rama en
todos los repos (--repo si hace falta elegir); los runs van a la memoria del hub (si no la
tiene, a la del submódulo). Dentro de un submódulo, bond team trabaja solo en ese repo.

status   Cada worktree del repo: estado, agente, commits por delante de la base y ficheros.
         Estados: trabajando, bloqueado, sin commitear, lista (commits por revisar),
         integrada (ya está en la base: por merge, fast-forward, rebase o squash), sin commits.
         La base, por defecto, es la rama del checkout principal.
         --watch: tabla en vivo (cada 2 s) agrupada por estado, en este orden: ⛔ necesita tu
         respuesta (con la pregunta debajo), 🔄 trabajando, ✏️ sin commitear, 📦 por revisar
         y ✅ integradas / sin empezar; los grupos vacíos no salen. El icono del estado va en
         el título del grupo; cada fila: minion, rama, commits y ficheros. Sale con q o Ctrl+C. En el
         panel de la tabla, si ninguna rama tiene trabajo pendiente (trabajando, bloqueado,
         sin commitear, lista, o un agente abierto sin commits aún), avisa y se cierra sola;
         no si es el panel enfocado ni con --keep-open. En un hub ([hub] en .bond/bond.toml),
         status y --watch enseñan los worktrees de toda la sesión en un panel tabla · <hub> con
         columna REPO.
prompt   Manda una tarea al agente de esa rama (herdr agent prompt); --wait espera a que acabe.
         Con la memoria de decisiones activa ([decisions] en bond.toml), guarda el encargo
         exacto en <dir>/runs/ (--no-record para no guardarlo); si la escritura falla,
         avisa y manda el prompt igual. Con memoria, el encargo lleva además una nota: lo
         que el agente registre en <dir>/ se commitea en su rama (viaja con el código).
collect  Recoge el informe del agente: toma solo su última respuesta del fichero de sesión
         que Herdr da en agent_session (en pi, un .jsonl; en agy, con su integración de
         Herdr, el transcript.jsonl de la conversación) y, si no puede leerlo, del panel
         recortado (sin banner de arranque ni avisos). Lo guarda en el run de esa rama de la
         memoria de decisiones, con el estado, los commits de la rama y las decisiones
         registradas por ese agente. Repetirlo reemplaza el informe y recalcula listas: no
         duplica nada. Sin run creado por prompt, lo crea con --request como encargo (para
         delegaciones sin equipo, como bond-delegate); --agent recoge por nombre de agente.
         Se niega mientras el agente trabaja o espera una respuesta.
clean    Quita worktrees (carpeta, workspace y agente); las ramas se quedan. Sin ramas, solo
         los integrados que abrió Herdr. Nunca uno con el agente trabajando o con cambios sin
         commitear, salvo con --force. --delete-branch borra además las ramas integradas.
         Si al acabar no queda ningún agente del equipo, cierra también el panel de la tabla
         en vivo; --keep-table lo deja abierto.`;

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
		if (o.layout && o.layout !== layout) die(`${flag} no va con --${o.layout} (bond team --help)`);
		o.layout = layout;
	};
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(`${a} necesita un valor (bond team --help)`);
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
	const session = hubOf(root);
	if (session) return createInHub(session, o);
	if (o.repos) die("--repos solo va en un hub (bond hub --help)");
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
	console.log(`\n  ${renderSmall(60, `equipo en ${repo}`)}\n`);
	printStatus(teamRows(root, o.base));
	console.log(dim(`\n  Repartir trabajo: bond team prompt <rama> "la tarea"\n  Cómo va: bond team status · Al acabar: bond team clean`));
}

/** Un workspace por rama con herdr worktree (fuera de Herdr, o con --workspaces). */
function openWorkspaces(root: string, plan: PlanItem[], o: TeamArgs): void {
	for (const item of plan) {
		const { branch, agent } = item;
		try {
			const r = openWorkspace({ dir: item.root ?? root, agent, worktree: branch, base: item.base ?? o.base, shell: false, direction: "right", ratio: "0.6", focus: false, trust: o.trust, agentArgs: defaultAgentArgs(agent, o.agentArgs) });
			console.log(`${ok("✓")} ${itemLabel(item)}  ${r.reused ? dim(`ya abierto (${r.ws})`) : `${r.agentName} (${agent}) en ${r.agentPane}${r.blocked ? caution(" · espera una respuesta tuya") : ""}`}`);
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
export const teamTabLabel = (repo: string, n: number) => `equipo · ${repo}${n > 1 ? ` · ${n}` : ""}`;

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
	{ layout: "tabs", text: (room, repo) => `Pestañas nuevas (por defecto): ${room ? `${room} en la tuya y el resto` : "todos"} en "${teamTabLabel(repo, 1)}", 4 por pestaña` },
	{ layout: "same-tab", text: () => "Todo en mi pestaña: en filas de 4, aunque se apriete" },
	{ layout: "workspaces", text: () => "Workspaces aparte: un workspace por rama (--workspaces)" },
];

/** Pregunta dónde van los agentes que no caben; Intro elige la 1. */
async function askLayout(n: number, room: number, repo: string): Promise<Layout> {
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	let answered = false;
	const cancel = () => {
		if (answered) return;
		console.log(dim("\n  Cancelado: no he creado nada."));
		process.exit(130);
	};
	rl.on("SIGINT", cancel);
	rl.on("close", cancel);
	console.log(`\n${n} agentes y en tu pestaña ${room === 1 ? "cabe 1" : `caben ${room}`} (${TAB_CAP} paneles como mucho: el tuyo, la tabla y 4 minions). ¿Dónde van?`);
	LAYOUT_CHOICES.forEach((c, i) => console.log(`  ${i + 1}) ${c.text(room, repo)}`));
	try {
		for (;;) {
			const a = (await rl.question("Elige [1]: ")).trim() || "1";
			const choice = /^[1-9]$/.test(a) ? LAYOUT_CHOICES[Number(a) - 1] : undefined;
			if (choice) {
				answered = true;
				return choice.layout;
			}
			console.log(`  ${LAYOUT_CHOICES.map((_, i) => i + 1).join(", ")} o Intro`);
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
	for (const s of pending.skipped) console.log(`${ok("✓")} ${itemLabel(s)}  ${dim(`ya tiene agente (${s.path})`)}`);
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
			if (!pane) throw new Error("no pude leer el panel nuevo de la respuesta de Herdr");
			panes.push(pane);
			const name = minionName(live);
			live.add(name);
			run("herdr", ["pane", "rename", pane, `${name} · ${label}`]);
			let trusted = false;
			if (o.inheritTrust && TRUST_KINDS.includes(agent)) {
				try {
					trusted = inheritTrust(agent, canonical(todo[i].root ?? root), canonical(path), undefined, !!orchestrator) === "heredada";
				} catch (e) {
					warn(`${label}: no pude heredar la confianza (${(e as Error).message}); ${agent} preguntará`);
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
			console.log(`${ok("✓")} ${label}  ${name} (${agent}) en ${pane}${split.tab ? dim(` · ${teamTabLabel(repo, split.tab)}`) : ""}${trusted ? dim(" · confianza heredada") : ""}${blocked ? caution(" · espera una respuesta tuya") : ""}`);
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
	return main?.branch ?? die("el checkout principal no está en una rama: indica la base con --base <ref>");
}

/** Bases de repos de la sesión ya avisadas por no existir (una vez por ejecución). */
export const warnedMissingBases = new Set<string>();

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
 * Filas de toda la sesión de trabajo. Si root (o un superproyecto que lo contiene) tiene [hub]
 * en .bond/bond.toml, devuelve las filas de cada repo de la sesión (cada una con `repo` y `base`
 * fijados a su base en [hub]). Si no es un hub, devuelve teamRows(root, base).
 */
export function sessionRows(root: string, base?: string): Row[] {
	const hub = hubRoot(root);
	const session = hub ? hubSession(hub) : undefined;
	if (!session) return teamRows(root, base);

	const live = serverRunning();
	const open = new Map<string, string>();
	let running: HerdrAgent[] = [];
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
		running = agents(5000);
	}

	const rows: Row[] = [];
	for (const hr of session.repos) {
		if (!hr.present) continue;
		if (git(hr.dir, ["rev-parse", "--verify", "--quiet", `${hr.base}^{commit}`]).status !== 0) {
			if (!warnedMissingBases.has(hr.dir)) {
				warnedMissingBases.add(hr.dir);
				warn(`la base no existe en ${hr.path}: ${hr.base}`);
			}
			continue;
		}
		const wts = gitWorktrees(hr.dir).filter((w) => !w.main && w.branch);
		for (const w of wts) {
			const branch = w.branch as string;
			const info = branchInfo(hr.dir, hr.base, branch, w.path);
			const workspace = open.get(w.path);
			const a = running.find((x) => x.agent && ((workspace && x.workspace_id === workspace) || within(canonical(x.cwd ?? x.foreground_cwd ?? "/"), w.path)));
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
				repo: hr.path === "." ? session.name : hr.path,
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

function printStatus(rows: Row[]): void {
	if (!rows.length) return console.log("Sin worktrees en este repo. Crea un equipo con: bond team <rama>...");
	const isHub = rows.some((r) => r.repo !== undefined);
	const head = isHub
		? ["REPO", "RAMA", "ESTADO", "AGENTE", "COMMITS", "FICHEROS", "DÓNDE"]
		: ["RAMA", "ESTADO", "AGENTE", "COMMITS", "FICHEROS", "DÓNDE"];
	const table = rows.map((r) => {
		const cols = [
			r.branch,
			r.state + (r.agent?.question ? `: ${r.agent.question}` : "") + (r.dirty && r.state !== "sin commitear" ? ` (+${r.dirty} sin commitear)` : ""),
			r.agent ? `${r.agent.name ?? "?"} (${r.agent.kind})` : "-",
			r.ahead ? `+${r.ahead}` : "-",
			r.files.length ? String(r.files.length) : "-",
			r.workspace ?? (r.agent?.pane ? `panel ${r.agent.pane}` : dim("cerrado")),
		];
		if (isHub) cols.unshift(r.repo ?? "-");
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

function status(args: string[]): void | Promise<void> {
	const { positional, opts } = parseCommon(args, ["--json", "-j", "--watch", "-w", "--keep-open"], ["--base", "-b"]);
	if (positional.length > 1) die("uso: bond team status [repo] [--base <ref>] [--json | --watch [--keep-open]]");
	const root = repoOf(positional[0]);
	const base = (opts["--base"] ?? opts["-b"]) as string | undefined;
	const hub = hubRoot(root);
	if (hub && base) die("en un hub cada repo usa su base de [hub] (.bond/bond.toml); quita --base");
	if (opts["--watch"] || opts["-w"]) {
		if (opts["--json"] || opts["-j"]) die("--watch y --json no van juntos");
		const targetRoot = hub ?? root;
		const targetBase = hub ? "" : (base ?? defaultBase(root));
		return watch(targetRoot, targetBase, !!opts["--keep-open"]);
	}
	if (opts["--keep-open"]) die("--keep-open va con --watch");
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
	{ icon: "⛔", title: "Necesita tu respuesta", states: ["bloqueado"] },
	{ icon: "🔄", title: "Trabajando", states: ["trabajando"] },
	{ icon: "✏️", title: "Sin commitear", states: ["sin commitear"] },
	{ icon: "📦", title: "Por revisar", states: ["lista"] },
	{ icon: "✅", title: "Integradas / sin empezar", states: ["integrada", "sin commits"] },
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
	if (!rows.length) out.push("", clip("Sin worktrees en este repo.", o.width));
	else {
		const cells = rows.map((r) => [
			r.agent?.name ?? "-",
			(isHub ? r.repo : r.branch) ?? "-",
			r.ahead ? `+${r.ahead}` : "-",
			r.files.length ? String(r.files.length) : "-",
		]);
		const widths = (h: string[]) => h.map((x, i) => Math.max(textWidth(x), ...cells.map((c) => textWidth(c[i]))));
		const room = (w: number[]) => w.reduce((a, b) => a + b + 2, 0);
		// En un panel estrecho, cabeceras cortas y, si aun así no cabe, la rama recortada.
		let head = isHub ? ["MINION", "REPO", "COMMITS", "FICHEROS"] : ["MINION", "RAMA", "COMMITS", "FICHEROS"];
		let w = widths(head);
		if (room(w) > o.width) w = widths((head = isHub ? ["MINION", "REPO", "COM", "FICH"] : ["MINION", "RAMA", "COM", "FICH"]));
		w[1] = Math.max(4, w[1] - Math.max(0, room(w) - o.width));
		const fmt = (c: string[]) => c.map((x, i) => pad(clip(x, w[i]), w[i])).join("  ").trimEnd();
		out.push("", clip(fmt(head), o.width));
		for (const g of WATCH_GROUPS) {
			const group = rows.flatMap((r, i) => (g.states.includes(r.state) ? [[r, cells[i]] as const] : []));
			if (!group.length) continue;
			out.push("", paintState(group[0][0].state, clip(`${g.icon} ${g.title}`, o.width), o.color));
			for (const [r, c] of group) {
				out.push(paintState(r.state, clip(fmt(c), o.width), o.color));
				if (r.agent?.question) out.push(clip(`   └ pregunta: ${r.agent.question}`, o.width));
			}
		}
	}
	if (o.notice) out.push("", ...o.notice.split("\n").map((l) => clip(l, o.width)));
	out.push("", dimmed(clip("q o Ctrl+C para salir · se actualiza cada 2 s", o.width)));
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
	if (!out.isTTY) die("--watch necesita una terminal (sin ella: bond team status --json)");
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
				notice = next === "busy" ? undefined : next === "close" ? `sin trabajo pendiente\nel panel se cierra en ${(CLOSE_TICKS - idleTicks) * 2} s` : "sin trabajo pendiente";
			}
			// Sin la última columna: escribir en ella y borrar el resto de la línea se come esa letra.
			lines = renderWatch(rows, { width: (out.columns || 80) - 1, color, repo, base, time: new Date().toTimeString().slice(0, 8), notice, hub: !!session });
		} catch (e) {
			lines = [`bond team · ${repo}`, "", clip(`error: ${(e as Error).message}`, out.columns || 80)];
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
export const watchLabel = (repo: string) => `tabla · ${repo}`;

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

interface HerdrPane {
	pane_id: string;
	tab_id?: string;
	workspace_id?: string;
	label?: string;
	focused?: boolean;
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
		if (pane && watching(pane)) return console.log(`${ok("✓")} tabla en vivo  ${dim(`ya abierta en ${pane}`)}`);
		if (!pane) {
			pane = herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", anchor, "--direction", "right", "--ratio", "0.6", "--cwd", targetRoot, "--no-focus"]).pane?.pane_id;
			if (!pane) throw new Error("no pude leer el panel nuevo de la respuesta de Herdr");
			run("herdr", ["pane", "rename", pane, watchLabel(repo)]);
		}
		herdr(["pane", "run", pane, watchCommand(targetRoot, base)]);
		console.log(`${ok("✓")} tabla en vivo  en ${pane}`);
	} catch (e) {
		warn(`tabla en vivo: ${(e as Error).message} (ábrela a mano: bond team status --watch)`);
	}
}

// --- mandar trabajo -------------------------------------------------------------------------

async function prompt(args: string[]): Promise<void> {
	requireHerdr();
	const { positional, opts } = parseCommon(args, ["--wait", "--no-record"], ["--timeout", "--repo"]);
	const [branch, ...words] = positional;
	if (!branch || !words.length) die('uso: bond team prompt <rama> "la tarea" [--repo <repo>] [--wait] [--timeout <ms>] [--no-record]');
	const root = repoOf();
	const extra = [...(opts["--wait"] ? ["--wait"] : []), ...(opts["--timeout"] ? ["--timeout", opts["--timeout"] as string] : [])];
	const session = hubOf(root);
	if (session) return promptInHub(session, branch, words.join(" "), opts, extra);
	if (opts["--repo"]) die("--repo solo va en un hub (bond hub --help)");
	const rows = teamRows(root);
	const row = rows.find((r) => r.branch === branch) ?? die(`no hay worktree para ${branch} (bond team status)`);
	const name = row.agent?.name ?? die(`${branch} no tiene un agente en marcha (bond team ${branch} para abrirlo)`);
	// Con una pregunta en pantalla, el Enter del prompt la contestaría por ti y la tarea se perdería.
	if (row.state === "bloqueado") die(`${name} espera una respuesta tuya${row.agent?.question ? ` (${row.agent.question})` : ""}: contéstale en su panel (herdr workspace focus ${row.workspace}) y repite`);
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
			warn(`run: ${(e as Error).message} (mando el prompt igual)`);
		}
	}
	// Herdr rechaza el prompt de un agente blocked: el aviso de arranque de agy se cierra con Esc.
	if (row.agent?.notice) run("herdr", ["agent", "send-keys", name, "esc"], { timeout: 5000 });
	const r = await promptAgent(name, task, extra);
	if (r.error !== undefined) die(`${name}: ${r.error}`);
	console.log(`${ok("✓")} ${branch} → ${name}${runRel ? `  ${dim(`run: ${runRel}`)}` : ""}${opts["--wait"] ? `  ${dim(r.status ?? "")}` : ""}`);
}

/** `herdr agent prompt`: el estado del agente al acabar (con --wait) o el error de Herdr. */
function promptAgent(name: string, task: string, extra: string[]): Promise<{ status?: string; error?: string }> {
	return new Promise((done) => {
		// Sin límite de tiempo propio: con --wait puede tardar lo que tarde el agente.
		const child = spawn("herdr", ["agent", "prompt", name, task, ...extra], { stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		let err = "";
		child.stdout.on("data", (d) => {
			out += d;
		});
		child.stderr.on("data", (d) => {
			err += d;
		});
		child.on("error", (e) => done({ error: e.message }));
		child.on("close", (code) => {
			let parsed: { result?: { agent?: { agent_status?: string } }; error?: { message?: string } } = {};
			try {
				parsed = JSON.parse(out || err || "{}");
			} catch {
				// Salida no JSON.
			}
			if (code !== 0 || parsed.error) done({ error: parsed.error?.message ?? (err || out).trim() });
			else done({ status: parsed.result?.agent?.agent_status });
		});
	});
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
	try {
		text = readFileSync(file, "utf8");
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
	while (i < lines.length && (/[╱╲]{3}/.test(lines[i]) || /\bpi v\d/.test(lines[i]) || /licence to code/i.test(lines[i]) || isAgyBanner(lines[i]))) i++;
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
	if (s.kind === "path") return s.value;
	if (s.kind !== "id" || !/^[\w-]+$/.test(s.value)) return undefined;
	if (s.agent === "agy") {
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

/** Los runs de <dir>/runs/, del más reciente al más antiguo (el nombre lleva la fecha). */
export function loadRuns(root: string, dirRel: string): RunOnDisk[] {
	const dir = runsDirAbs(root, dirRel);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md") && f !== "README.md")
		.sort()
		.reverse()
		.map((f) => readRun(f, `${dirRel}/runs/${f}`, readFileSync(join(dir, f), "utf8")))
		.filter((r): r is RunOnDisk => !!r);
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
	if (!text) die("el encargo está vacío (bond team prompt <rama> \"la tarea\")");
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
	const run_ = loadRuns(ctx.mainRoot, ctx.dir).find((r) => r.fm.scalars.branch === ctx.branch && (!ctx.agent || r.fm.scalars.agent === ctx.agent));
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
	status === "working" ? "está trabajando" : status === "blocked" ? "espera una respuesta tuya" : undefined;

function collect(args: string[]): void {
	requireHerdr();
	const { positional, opts } = parseCommon(args, [], ["--lines", "--agent", "--request", "--repo"]);
	const usage = "uso: bond team collect <rama> [--repo <repo>] [--lines <n>] [--agent <nombre>] [--request <encargo>]";
	const branch = positional[0] ?? die(usage);
	if (positional.length > 1) die(usage);
	const root = repoOf();
	const session = hubOf(root);
	if (session) return collectInHub(session, branch, opts);
	if (opts["--repo"]) die("--repo solo va en un hub (bond hub --help)");
	const main = gitWorktrees(root).find((w) => w.main)?.path ?? root;
	const { value: dec, error } = catchDie(() => repoDecisions(main));
	if (error !== undefined) die(`no pude leer [decisions] de ${main}: ${error}`);
	if (!dec) die("este repo no usa la memoria de decisiones: añade la sección [decisions] a .bond/bond.toml (bond init la propone) y ejecuta bond sync");
	const row = teamRows(root).find((r) => r.branch === branch);
	const agent = (opts["--agent"] as string | undefined) || row?.agent?.name || die(`no hay agente en la rama ${branch} y no diste --agent (bond team status)`);
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
	if (busy) die(`${agent} ${busy}: espera a que termine (herdr agent wait ${agent}) y repite`);
	const lines = String(opts["--lines"] ?? "200");
	// D17: el informe sale del fichero de sesión del agente; el panel recortado es el respaldo.
	const { report, source } = agentReport(agent, () => {
		const rd = run("herdr", ["agent", "read", agent, "--source", "recent-unwrapped", "--lines", lines], { timeout: 20_000 });
		if (rd.status !== 0) die(`no pude leer el panel de ${agent}: ${(rd.stderr || rd.stdout).trim()}`);
		return rd.stdout;
	}, ctx.kind);
	const out = collectRun(ctx, report, { request: opts["--request"] as string | undefined });
	console.log(`${ok("~")} ${out.rel}  ${dim(`reported · informe desde la ${source} · ${out.commits.length} commit(s) de ${branch} · ${out.decisions.length} decisión(es) de ${agent}`)}`);
}

// --- quitar worktrees -----------------------------------------------------------------------

function clean(args: string[]): void {
	const { positional, opts } = parseCommon(args, ["--force", "--delete-branch", "--keep-table", "--dry-run"], ["--base", "-b", "--repo"]);
	const dir = positional.length && existsSync(positional[0]) ? positional.shift() : undefined;
	const root = repoOf(dir);
	const session = hubOf(root);
	if (session) return cleanInHub(session, positional, opts);
	if (opts["--repo"]) die("--repo solo va en un hub (bond hub --help)");
	const rows = teamRows(root, (opts["--base"] ?? opts["-b"]) as string | undefined);
	const unknown = positional.filter((b) => !rows.some((r) => r.branch === b));
	if (unknown.length) die(`sin worktree: ${unknown.join(", ")} (bond team status)`);

	const targets = positional.length ? rows.filter((r) => positional.includes(r.branch)) : rows.filter((r) => r.state === "integrada" && r.managed);
	if (!positional.length) {
		const outside = rows.filter((r) => r.state === "integrada" && !r.managed);
		for (const r of outside) console.log(dim(`  ${r.branch}: integrada, pero no la abrió Herdr (${r.path}); nómbrala para quitarla`));
	}
	const removed = new Set<Row>();
	// Al acabar, sin agentes del equipo, la tabla en vivo sobra.
	const tableLeft = () => (opts["--keep-table"] ? undefined : closeIdleTable(root, rows.filter((r) => !removed.has(r))));
	if (!targets.length) {
		console.log(positional.length ? "Nada que quitar." : "Ninguna rama integrada que quitar (bond team status).");
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
		if (ws) console.log(dim(`  El workspace del repo (${ws.label}) sigue abierto; si ya no lo usas: herdr workspace close ${ws.workspace_id}`));
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
		const why =
			r.state === "trabajando" ? "el agente está trabajando" : r.state === "sin commitear" || r.dirty ? `${r.dirty} cambio(s) sin commitear` : within(cwd, r.path) ? "estás dentro" : r.state === "bloqueado" ? "el agente espera una respuesta" : undefined;
		if (why && !force) {
			warn(`${label}: no lo quito, ${why} (--force para quitarlo igualmente)`);
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
			warn(`${label}: ${(e as Error).message}`);
			continue;
		}
		removed.add(r);
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
			console.log(`${ok("-")} tabla en vivo  ${dim(`${pane} · no queda ningún agente del equipo (--keep-table para dejarla)`)}`);
		} catch (e) {
			warn(`tabla en vivo: ${(e as Error).message}`);
		}
	}
}

// --- equipo vertical en un hub -------------------------------------------------------------
//
// En un hub ([hub] en su bond.toml, la escribe bond hub), una rama vertical se llama igual en
// todos los repos que toca (D1). En el hub es solo una rama (D3, D7); en cada submódulo, un
// worktree y un agente (D2). Una sola rama vertical por sesión (D10). Desde un submódulo,
// bond team trabaja solo en ese repo, como siempre.

/** La sesión si `root` es un hub; undefined si no (un repo normal o un submódulo). */
const hubOf = (root: string): HubSession | undefined => catchDie(() => hubSession(root)).value;

/** Los repos de la sesión donde trabajan los agentes: los submódulos que están en disco. */
const subRepos = (s: HubSession) => s.repos.filter((r) => r.path !== "." && r.present);

/** Los repos nombrados (por ruta o, si no se repite, por nombre de carpeta); sin nombres, todos. */
export function pickRepos(repos: HubRepo[], names: string[] | undefined, flag: string): HubRepo[] {
	if (!names) return repos;
	const out: HubRepo[] = [];
	for (const n of names) {
		const key = n.replace(/\\/g, "/").replace(/\/+$/, "");
		const exact = repos.filter((r) => r.path === key);
		const hits = exact.length ? exact : repos.filter((r) => basename(r.path) === key);
		if (!hits.length) die(`${flag} ${n}: no es un repo de la sesión (${repos.map((r) => r.path).join(", ")})`);
		if (hits.length > 1) die(`${flag} ${n}: hay varios (${hits.map((r) => r.path).join(", ")}); usa la ruta`);
		if (!out.includes(hits[0])) out.push(hits[0]);
	}
	return out;
}

/**
 * Ramas verticales abiertas en la sesión: las que tienen worktree en algún submódulo y existen
 * también en el hub (bond team las crea en los dos; clean quita los worktrees y deja las ramas).
 */
export function openVerticals(s: HubSession): string[] {
	const inHub = (b: string) => git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]).status === 0;
	const open = new Set<string>();
	for (const r of subRepos(s)) for (const w of gitWorktrees(r.dir)) if (!w.main && w.branch && inHub(w.branch)) open.add(w.branch);
	return [...open].sort();
}

/** Las filas de la sesión (sessionRows, cada una con su `repo`) que son de esos submódulos. */
const subRows = (s: HubSession, repos: HubRepo[]) => sessionRows(s.root).filter((row) => repos.some((r) => r.path === row.repo));

/** El submódulo de [hub] de una fila de subRows. */
const repoOfRow = (s: HubSession, row: Row) => subRepos(s).find((r) => r.path === row.repo) as HubRepo;

async function createInHub(s: HubSession, o: TeamArgs): Promise<void> {
	if (o.specs.length > 1) die(`en un hub, una sola rama vertical por sesión (D2): bond team <rama>[:agente] [--repos a,b], no ${o.specs.map((x) => x.branch).join(" ")}`);
	if (o.base) die("en un hub, cada repo sale de su base de [hub] (bond hub la cambia): sin --base");
	const { branch, agent: asked } = o.specs[0];
	if (git(s.root, ["check-ref-format", "--branch", branch]).status !== 0) die(`nombre de rama no válido para git: ${JSON.stringify(branch)}`);
	const subs = subRepos(s);
	if (!subs.length) die(`${s.name} no tiene submódulos en su sesión: bond hub sync`);
	const targets = pickRepos(subs, o.repos, "--repos");
	const open = openVerticals(s).filter((b) => b !== branch);
	if (open.length) die(`${s.name} ya tiene abierta la rama vertical ${open.join(", ")} y solo cabe una por sesión: ciérrala antes con bond team clean ${open[0]} (las ramas se quedan)`);
	const noBase = targets.filter((r) => git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status !== 0);
	if (noBase.length) die(`la base no existe en ${noBase.map((r) => `${r.path} (${r.base})`).join(", ")}: cámbiala con bond hub --base <ruta>=<ref>`);

	// El agente de cada repo: el de rama:agente, si no --agent, si no el de su bond.toml.
	const plan: PlanItem[] = [];
	const { loadRepoAgents } = await import("./repo.mts");
	for (const r of targets) {
		const own = existsSync(join(r.dir, ".bond", "bond.toml")) ? catchDie(() => loadRepoAgents(r.dir)).value : undefined;
		const agent = await chooseAgent(asked ?? o.agent, own?.default_agent);
		if (own && !own.agents.includes(agent)) warn(`${r.path}: ${agent} no está entre los agentes del repo: sin su config (MCP, skills...). Añádelo con bond init`);
		if (git(r.dir, ["status", "--porcelain"]).stdout.trim()) warn(`${r.path}: hay cambios sin commitear: el worktree sale de lo commiteado y no los verá`);
		plan.push({ branch, agent, root: r.dir, sub: r.path, base: r.base });
	}

	// En el hub, la rama vertical es solo una rama: sin worktree ni agente (D7).
	if (git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0) console.log(`${ok("✓")} ${branch} · ${s.name}  ${dim("la rama ya está en el hub")}`);
	else {
		const g = git(s.root, ["branch", branch, s.repos[0].base]);
		if (g.status !== 0) die(`${s.name}: git branch ${branch} ${s.repos[0].base}: ${g.stderr.trim()}`);
		console.log(`${ok("✓")} ${branch} · ${s.name}  ${dim(`rama del hub desde ${s.repos[0].base}, sin worktree ni agente`)}`);
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
	console.log(`\n  ${renderSmall(60, `${branch} en ${s.name}`)}\n`);
	printStatus(subRows(s, targets).filter((r) => r.branch === branch));
	console.log(dim(`\n  Repartir trabajo: bond team prompt ${branch} "la tarea" (a todos; --repo <repo> a uno)\n  Recoger: bond team collect ${branch} --repo <repo> · Al acabar: bond team clean ${branch}`));
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
	if (!all.length) die(`no hay worktree para ${branch} en ningún repo de ${s.name} (bond team status)`);
	const only = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo")[0] : undefined;
	const targets = only ? all.filter((r) => r.repo === only.path) : all;
	if (!targets.length) die(`${branch} no tiene worktree en ${only?.path} (bond team status)`);
	for (const r of targets) if (!r.agent?.name) warn(`${r.repo}: ${branch} no tiene un agente en marcha (bond team ${branch} para abrirlo)`);
	const live = targets.filter((r) => r.agent?.name);
	if (!live.length) die(`${branch} no tiene ningún agente en marcha${only ? ` en ${only.path}` : ""} (bond team ${branch} para abrirlo)`);
	// Con una pregunta en pantalla, el Enter del prompt la contestaría por ti: no se manda a nadie.
	const blocked = live.filter((r) => r.state === "bloqueado");
	if (blocked.length) die(`${blocked.map((r) => `${r.agent?.name} (${r.repo})${r.agent?.question ? `: ${r.agent.question}` : ""}`).join(", ")} espera una respuesta tuya: contéstale en su panel y repite (no he mandado nada)`);
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
					warn(`${row.repo}: run: ${(e as Error).message} (mando el prompt igual)`);
				}
			}
			if (row.agent?.notice) run("herdr", ["agent", "send-keys", name, "esc"], { timeout: 5000 });
			return { row, name, runRel, r: await promptAgent(name, task, extra) };
		}),
	);
	for (const { row, name, runRel, r } of sent) {
		if (r.error !== undefined) {
			warn(`${row.repo}: ${name}: ${r.error}`);
			process.exitCode = 1;
		} else console.log(`${ok("✓")} ${branch} · ${row.repo} → ${name}${runRel ? `  ${dim(`run: ${runRel}`)}` : ""}${opts["--wait"] ? `  ${dim(r.status ?? "")}` : ""}`);
	}
}

/** bond team collect en un hub: el informe del agente de la rama en su repo (--repo si hay varios). */
function collectInHub(s: HubSession, branch: string, opts: Record<string, string | true>): void {
	const repos = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo") : subRepos(s);
	let found = subRows(s, repos).filter((r) => r.branch === branch);
	if (opts["--agent"]) found = found.filter((r) => r.agent?.name === opts["--agent"]);
	if (!found.length) die(`no hay worktree para ${branch}${opts["--agent"] ? ` con ${opts["--agent"]}` : ""} en ${opts["--repo"] ? repos[0].path : `ningún repo de ${s.name}`} (bond team status)`);
	if (found.length > 1) die(`${branch} está en ${found.length} repos (${found.map((r) => r.repo).join(", ")}): recoge uno a uno con --repo <repo>`);
	const [row] = found;
	const repo = repoOfRow(s, row);
	const agent = row.agent?.name ?? die(`${branch} no tiene agente en ${repo.path} (bond team status)`);
	const ctx = hubRunCtx(s, repo, row, agent) ?? die(`ni ${s.name} ni ${repo.path} usan la memoria de decisiones: añade la sección [decisions] a .bond/bond.toml del hub (bond init la propone) y ejecuta bond sync`);
	collectInto(ctx, row.agent?.status, opts);
}

/** bond team clean en un hub: los worktrees de la rama en todos los repos de la sesión (o en el de --repo). */
function cleanInHub(s: HubSession, branches: string[], opts: Record<string, string | true>): void {
	if (opts["--base"] ?? opts["-b"]) die("en un hub, cada repo se compara con su base de [hub]: sin --base");
	const repos = opts["--repo"] ? pickRepos(subRepos(s), [opts["--repo"] as string], "--repo") : subRepos(s);
	const rows = subRows(s, repos);
	const unknown = branches.filter((b) => !rows.some((r) => r.branch === b));
	if (unknown.length) die(`sin worktree en ${opts["--repo"] ? repos[0].path : s.name}: ${unknown.join(", ")} (bond team status)`);
	const targets = branches.length ? rows.filter((r) => branches.includes(r.branch)) : rows.filter((r) => r.state === "integrada" && r.managed);
	if (!branches.length) for (const r of rows.filter((y) => y.state === "integrada" && !y.managed)) console.log(dim(`  ${itemLabel({ branch: r.branch, sub: r.repo })}: integrada, pero no la abrió Herdr (${r.path}); nómbrala para quitarla`));
	const removed = new Set<Row>();
	if (!targets.length) console.log(branches.length ? "Nada que quitar." : "Ninguna rama integrada que quitar (bond team status).");
	for (const repo of repos) {
		const mine = targets.filter((r) => r.repo === repo.path);
		if (!mine.length) continue;
		for (const r of removeWorktrees(repo.dir, mine, opts, repo.path)) removed.add(r);
		if (!isDryRun()) git(repo.dir, ["worktree", "prune"]);
	}
	// La carpeta del hub en ~/.herdr/worktrees, si se queda vacía.
	const hubDir = join(homedir(), ".herdr", "worktrees", s.name);
	if (!isDryRun() && removed.size && existsSync(hubDir) && readdirSync(hubDir).length === 0) rmdirSync(hubDir);
	if (removed.size) console.log(dim(`  Las ramas se quedan, en ${s.name} y en cada repo`));
	if (!opts["--keep-table"]) closeIdleTable(s.root, rows.filter((r) => !removed.has(r)));
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
