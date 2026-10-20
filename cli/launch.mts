// `bond` (y `bond dev`): abre el puesto de trabajo de un repo en Herdr: el agente por defecto en
// un panel y una shell en otro. Fuera de Herdr arranca el servidor y engancha la interfaz; dentro,
// crea o enfoca el workspace. Con --worktree, el workspace es un worktree de git (herdr worktree).

import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { agents, attach, ensureServer, focusWorkspace, herdr, insideHerdr, requireHerdr, slugify, supportedKinds, uniqueAgentName, workspaceByLabel } from "./herdr.mts";
import { caution, die, dim, log, ok, run, warn, which } from "./util.mts";

export const LAUNCH_HELP = `Uso: bond [opciones] [-- argumentos del agente]
       bond dev [directorio] [opciones] [-- argumentos del agente]

Dentro de un repo, abre su puesto de trabajo en Herdr: el agente por defecto del repo
(.bond/bond.toml) en un panel y una shell en otro. Si el workspace ya existe, lo enfoca.
Fuera de Herdr arranca su servidor y engancha la interfaz. Si el repo no tiene bond, ofrece
bond init; si su config está desfasada, la regenera antes.

  -a, --agent <agente>          Otro agente en vez del de por defecto (pi, claude, codex...)
  -w, --worktree <rama>         En un worktree de git para <rama> (herdr worktree)
  -b, --base <ref>              Con --worktree: ref de la que sale una rama nueva
  -d, --direction <right|down>  Dónde va la shell (defecto: right)
  -r, --ratio <0.1-0.9>         Fracción del panel del agente (defecto: 0.6)
  -l, --label <texto>           Etiqueta del workspace (defecto: bond:<repo>[/<rama>])
  --no-agent                    Solo paneles de shell
  --no-attach                   No enganchar la interfaz de Herdr al terminar
  --no-focus                    Abrirlo en segundo plano (sin cambiar de workspace ni enganchar)
  --trust-repository            Se pasa a herdr worktree (solo en repos revisados)`;

export interface OpenOptions {
	dir: string;
	agent?: string;
	worktree?: string;
	base?: string;
	label?: string;
	direction: string;
	ratio: string;
	focus: boolean;
	trust: boolean;
	agentArgs: string[];
}

export interface Opened {
	ws: string;
	label: string;
	cwd: string;
	agentPane?: string;
	shellPane?: string;
	agentName?: string;
	reused: boolean;
	blocked?: boolean;
}

const gitRoot = (dir: string) => {
	const r = run("git", ["-C", dir, "rev-parse", "--show-toplevel"]);
	return r.status === 0 ? r.stdout.trim() : undefined;
};

/** Crea (o reutiliza) el workspace de un repo y lanza el agente en él. */
export function openWorkspace(o: OpenOptions): Opened {
	let project = resolve(o.dir);
	if (o.worktree) project = gitRoot(project) ?? die(`--worktree necesita un repo git: ${project}`);
	const name = basename(project);
	const baseLabel = `bond:${name}`;
	const label = o.label ?? `${baseLabel}${o.worktree ? `/${o.worktree}` : ""}`;
	const trust = o.trust ? ["--trust-repository"] : [];
	const focus = o.focus ? "--focus" : "--no-focus";

	// Reutiliza por etiqueta (también la de antes del renombrado: pi:<repo>).
	const legacy = label.replace(/^bond:/, "pi:");
	const existing = workspaceByLabel(label, legacy);
	if (existing) {
		if (o.focus) focusWorkspace(existing);
		return { ws: existing, label, cwd: project, reused: true };
	}

	let created: { workspace?: { workspace_id: string }; root_pane?: { pane_id: string; cwd?: string } };
	if (!o.worktree) {
		created = herdr(["workspace", "create", "--cwd", project, "--label", label, focus]);
	} else {
		// Los worktrees cuelgan del workspace del repo; si no existe se crea, para que Herdr no abra
		// otro sin etiqueta para el repo principal.
		let base = workspaceByLabel(baseLabel, `pi:${name}`);
		if (!base) base = herdr<{ workspace: { workspace_id: string } }>(["workspace", "create", "--cwd", project, "--label", baseLabel, "--no-focus"]).workspace.workspace_id;
		const list = herdr<{ worktrees?: Array<{ branch?: string; path?: string }> }>(["worktree", "list", "--workspace", base, ...trust]).worktrees ?? [];
		const has = list.some((w) => w.branch === o.worktree);
		created = herdr([
			"worktree",
			has ? "open" : "create",
			"--workspace",
			base,
			"--branch",
			o.worktree,
			...(!has && o.base ? ["--base", o.base] : []),
			"--label",
			label,
			focus,
			...trust,
		]);
	}
	const ws = created.workspace?.workspace_id;
	const agentPane = created.root_pane?.pane_id;
	const cwd = created.root_pane?.cwd || project;
	if (!ws || !agentPane) die("no pude leer los ids de la respuesta de Herdr");

	const split = herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", agentPane, "--direction", o.direction, "--ratio", o.ratio, "--cwd", cwd, "--no-focus"]);
	const shellPane = split.pane?.pane_id;

	if (!o.agent) return { ws, label, cwd, agentPane, shellPane, reused: false };
	const agentName = uniqueAgentName(slugify(`${o.agent}-${name}${o.worktree ? `-${o.worktree}` : ""}`));
	try {
		herdr(["agent", "start", agentName, "--kind", o.agent, "--pane", agentPane, "--timeout", "60000", ...(o.agentArgs.length ? ["--", ...o.agentArgs] : [])]);
		return { ws, label, cwd, agentPane, shellPane, agentName, reused: false };
	} catch {
		// Suele ser una pregunta del agente (confiar en la carpeta...): no se contesta por ti.
		const blocked = agents().find((a) => a.name === agentName)?.agent_status === "blocked";
		return { ws, label, cwd, agentPane, shellPane, agentName, reused: false, blocked };
	}
}

function parse(args: string[], withDir: boolean) {
	const o = { dir: process.cwd(), dirGiven: false, agent: undefined as string | undefined, worktree: undefined as string | undefined, base: undefined as string | undefined, label: undefined as string | undefined, direction: "right", ratio: "0.6", noAgent: false, attach: true, focus: true, trust: false, agentArgs: [] as string[] };
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(`${a} necesita un valor`);
		if (a === "-a" || a === "--agent" || a === "-k" || a === "--kind") o.agent = val();
		else if (a === "-w" || a === "--worktree") o.worktree = val();
		else if (a === "-b" || a === "--base") o.base = val();
		else if (a === "-d" || a === "--direction") o.direction = val();
		else if (a === "-r" || a === "--ratio") o.ratio = val();
		else if (a === "-l" || a === "--label") o.label = val();
		else if (a === "--no-agent") o.noAgent = true;
		else if (a === "--no-attach") o.attach = false;
		else if (a === "--no-focus") {
			o.focus = false;
			o.attach = false;
		}
		else if (a === "--attach") o.attach = true;
		else if (a === "--trust-repository") o.trust = true;
		else if (a === "--") {
			o.agentArgs = args.slice(i + 1);
			break;
		} else if (a.startsWith("-")) die(`opción desconocida: ${a} (bond --help)`);
		else if (withDir && !o.dirGiven) {
			o.dir = resolve(a);
			o.dirGiven = true;
		} else die(`argumento inesperado: ${a} (bond --help)`);
	}
	if (!["right", "down"].includes(o.direction)) die("--direction debe ser right o down");
	if (o.base && !o.worktree) die("--base solo tiene sentido con --worktree");
	return o;
}

/** Agente a lanzar: el pedido, el del repo, el de bond setup o el primero instalado. */
async function chooseAgent(asked: string | undefined, repoDefault: string | undefined): Promise<string> {
	let agent = asked ?? repoDefault;
	if (!agent) {
		try {
			const { configExists, loadConfig } = await import("./config.mts");
			if (configExists()) agent = loadConfig().default_agent;
		} catch {
			// Sin config global.
		}
	}
	agent ??= ["pi", "claude", "codex", "copilot", "opencode", "crush", "gemini"].find((a) => which(a));
	if (!agent) die("no hay ningún agente instalado (bond setup te dice cómo instalar uno)");
	const kinds = supportedKinds();
	if (kinds.length && !kinds.includes(agent)) die(`Herdr no admite el agente '${agent}'. Válidos: ${kinds.join(", ")}`);
	if (!which(agent)) die(`'${agent}' no está instalado`);
	return agent;
}

export async function launch(args: string[], opts: { dev: boolean }): Promise<void> {
	requireHerdr();
	const o = parse(args, opts.dev);
	const root = gitRoot(o.dir) ?? o.dir;
	const hasBond = existsSync(join(root, ".bond", "bond.toml"));

	// Repo sin bond: se ofrece init (solo con `bond` a secas y terminal).
	let repoDefault: string | undefined;
	if (!hasBond && !opts.dev && process.stdin.isTTY) {
		const p = await import("@clack/prompts");
		const yes = await p.confirm({ message: `${basename(root)} no tiene bond. ¿Inicializarlo ahora (bond init)?`, initialValue: true });
		if (p.isCancel(yes)) process.exit(130);
		if (yes) {
			process.chdir(root);
			const { init } = await import("./repo.mts");
			await init([]);
		}
	}
	if (existsSync(join(root, ".bond", "bond.toml"))) {
		process.chdir(root);
		const { syncRepo } = await import("./repo.mts");
		// La config del repo al día antes de abrir el agente (bond.toml pudo cambiar).
		const pending = syncRepo({ check: true, quiet: true }).filter((a) => a.sign !== "!");
		if (pending.length) {
			log(`config del repo desfasada (${pending.length} cambio(s)): bond sync`);
			syncRepo({ quiet: true });
		}
		const { loadRepoDefault } = await import("./repo.mts");
		repoDefault = loadRepoDefault(root);
	}
	const agent = o.noAgent ? undefined : await chooseAgent(o.agent, repoDefault);

	const inside = insideHerdr();
	if (!inside) await ensureServer();
	const r = openWorkspace({ dir: root, agent, worktree: o.worktree, base: o.base, label: o.label, direction: o.direction, ratio: o.ratio, focus: o.focus, trust: o.trust, agentArgs: o.agentArgs });

	const { renderSmall } = await import("../lib/bond-logo.mts");
	console.log(`\n  ${renderSmall(60, r.reused ? `workspace ${r.label}` : `${agent ?? "shell"} · ${r.label}`)}`);
	if (r.reused) console.log(dim(`  ya estaba abierto (${r.ws})${o.focus ? "; enfocado" : ""}`));
	else {
		console.log(`  workspace ${r.ws}  ${dim(r.cwd)}`);
		if (r.agentName) console.log(`  agente    ${r.agentName} (${agent}) en ${r.agentPane}${r.blocked ? caution("  · espera una respuesta tuya (p. ej. confiar en la carpeta)") : ""}`);
		console.log(`  shell     ${r.shellPane}`);
		if (o.worktree) console.log(dim(`  al terminar con el worktree: herdr worktree remove --workspace ${r.ws}`));
	}
	if (!inside && o.attach) attach();
	if (inside) console.log(ok(o.focus ? "  listo" : "  listo (en segundo plano)"));
	else console.log(dim("  herdr para engancharte"));
}

export const TEAM_HELP = `Uso: bond team [repo] <rama[:agente]>... [opciones] [-- argumentos de los agentes]

Abre un worktree y un agente por rama, en segundo plano, y enseña los agentes del repo.
Sin [repo], el repo del directorio actual. El agente de cada rama: el de rama:agente, si no
--agent, si no el agente por defecto del repo (.bond/bond.toml), si no el de bond setup.
Los worktrees salen de lo commiteado: lo que no esté en un commit no lo verán.

  -a, --agent <agente>   Agente para las ramas sin :agente
  -b, --base <ref>       Ref de la que salen las ramas nuevas
  --trust-repository     Se pasa a herdr worktree (solo en repos revisados)`;

export interface TeamArgs {
	dir?: string;
	agent?: string;
	base?: string;
	trust: boolean;
	specs: Array<{ branch: string; agent?: string }>;
	agentArgs: string[];
}

/**
 * Argumentos de bond team. El primero es el repo solo si es una carpeta que existe; si no, es
 * ya una rama (bond team feat/a feat/b:claude, dentro del repo).
 */
export function parseTeam(args: string[], isDir: (p: string) => boolean = existsSync): TeamArgs {
	const o: TeamArgs = { trust: false, specs: [], agentArgs: [] };
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(`${a} necesita un valor (bond team --help)`);
		if (a === "-k" || a === "--kind" || a === "-a" || a === "--agent") o.agent = val();
		else if (a === "-b" || a === "--base") o.base = val();
		else if (a === "--trust-repository") o.trust = true;
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

/** `bond team`: un agente por rama, cada uno en su worktree. */
export async function team(args: string[]): Promise<void> {
	requireHerdr();
	const o = parseTeam(args);
	const root = gitRoot(resolve(o.dir ?? ".")) ?? die(`no es un repo git: ${resolve(o.dir ?? ".")}`);
	// Antes de tocar Herdr: un nombre de rama inválido dejaría un workspace a medias.
	const bad = o.specs.filter((s) => run("git", ["-C", root, "check-ref-format", "--branch", s.branch]).status !== 0).map((s) => s.branch);
	if (bad.length) die(`nombre de rama no válido para git: ${bad.map((b) => JSON.stringify(b)).join(", ")}`);

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
	for (const { branch, agent } of plan) {
		try {
			const r = openWorkspace({ dir: root, agent, worktree: branch, base: o.base, direction: "right", ratio: "0.6", focus: false, trust: o.trust, agentArgs: o.agentArgs });
			console.log(`${ok("✓")} ${branch}  ${r.reused ? dim(`ya abierto (${r.ws})`) : `${r.agentName} (${agent}) en ${r.agentPane}${r.blocked ? caution(" · espera una respuesta tuya") : ""}`}`);
		} catch (e) {
			warn(`${branch}: ${(e as Error).message}`);
		}
	}
	const { renderSmall } = await import("../lib/bond-logo.mts");
	console.log(`\n  ${renderSmall(60, `equipo en ${basename(root)}`)}\n`);
	status([], `/worktrees/${basename(root)}/`);
	console.log(dim(`\n  Repartir trabajo: herdr agent prompt <agente> "la tarea" --wait\n  Quitar un worktree (borra la carpeta, no la rama): herdr worktree remove --workspace <id>`));
}

/** `bond status`: agentes vivos en Herdr. */
export function status(args: string[], cwdFilter?: string): void {
	requireHerdr();
	const list = agents();
	if (args.includes("--json") || args.includes("-j")) return console.log(JSON.stringify(list, null, 2));
	const rows = list
		.filter((a) => !cwdFilter || (a.cwd ?? a.foreground_cwd ?? "").includes(cwdFilter))
		.map((a) => [a.name ?? "(sin nombre)", a.agent ?? "?", a.agent_status ?? "?", a.cwd ?? a.foreground_cwd ?? "-", a.pane_id]);
	if (!rows.length) return console.log(cwdFilter ? "Sin agentes de este repo." : "Sin agentes vivos. Abre uno con: bond");
	const head = ["AGENTE", "KIND", "ESTADO", "CWD", "PANEL"];
	const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
	for (const r of [head, ...rows]) console.log(r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i]))).join("  "));
}
