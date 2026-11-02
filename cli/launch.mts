// `bond` (y `bond dev`): abre el puesto de trabajo de un repo en Herdr: el agente por defecto en
// un panel y una shell en otro. Fuera de Herdr arranca el servidor y engancha la interfaz; dentro,
// crea o enfoca el workspace. Con --worktree, el workspace es un worktree de git (herdr worktree).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, delimiter, join, resolve } from "node:path";
import { agents, attach, ensureServer, focusWorkspace, herdr, insideHerdr, missingAgentDir, preparePane, requireHerdr, slugify, startedBlocked, supportedKinds, uniqueAgentName, workspaceByLabel } from "./herdr.mts";
import { t } from "./messages.mts";
import { caution, die, dim, log, ok, run, warn, which } from "./util.mts";

export const launchHelp = (): string => t("launch.help");
export const LAUNCH_HELP = Object.assign(() => launchHelp(), { toString: () => launchHelp(), [Symbol.toPrimitive]: () => launchHelp(), [Symbol.for("nodejs.util.inspect.custom")]: () => launchHelp() });

export interface OpenOptions {
	dir: string;
	agent?: string;
	worktree?: string;
	base?: string;
	label?: string;
	/** Una shell en otro panel, junto al agente (direction, ratio). */
	shell: boolean;
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

export const gitRoot = (dir: string) => {
	const r = run("git", ["-C", dir, "rev-parse", "--show-toplevel"]);
	return r.status === 0 ? r.stdout.trim() : undefined;
};

/** Etiqueta del workspace de un repo: bond:<repo>[/<rama>], o la pedida con --label. */
export const workspaceLabel = (project: string, worktree?: string, label?: string) => label ?? `bond:${basename(project)}${worktree ? `/${worktree}` : ""}`;

/** Crea (o reutiliza) el workspace de un repo y lanza el agente en él. */
export function openWorkspace(o: OpenOptions): Opened {
	let project = resolve(o.dir);
	if (o.worktree) project = gitRoot(project) ?? die(t("launch.worktree_needs_git", { path: project }));
	const name = basename(project);
	const baseLabel = `bond:${name}`;
	const label = workspaceLabel(project, o.worktree, o.label);
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
	if (!ws || !agentPane) die(t("launch.no_herdr_ids"));

	const shellPane = o.shell
		? herdr<{ pane?: { pane_id: string } }>(["pane", "split", "--pane", agentPane, "--direction", o.direction, "--ratio", o.ratio, "--cwd", cwd, "--no-focus"]).pane?.pane_id
		: undefined;

	if (!o.agent) return { ws, label, cwd, agentPane, shellPane, reused: false };
	// El del checkout principal es gru, el que orquesta; los de worktrees, por agente y rama.
	const agentName = uniqueAgentName(o.worktree ? slugify(`${o.agent}-${name}-${o.worktree}`) : "gru");
	preparePane(agentPane, o.agent);
	try {
		herdr(["agent", "start", agentName, "--kind", o.agent, "--pane", agentPane, "--timeout", "60000", ...(o.agentArgs.length ? ["--", ...o.agentArgs] : [])]);
		return { ws, label, cwd, agentPane, shellPane, agentName, reused: false, blocked: startedBlocked(agentName, false) };
	} catch {
		// Suele ser una pregunta del agente (confiar en la carpeta...): no se contesta por ti.
		return { ws, label, cwd, agentPane, shellPane, agentName, reused: false, blocked: startedBlocked(agentName, true) };
	}
}

export function parseLaunch(args: string[], withDir: boolean) {
	const o = { dir: process.cwd(), dirGiven: false, agent: undefined as string | undefined, worktree: undefined as string | undefined, base: undefined as string | undefined, label: undefined as string | undefined, shell: false, direction: "right", ratio: "0.6", noAgent: false, attach: true, focus: true, trust: false, agentArgs: [] as string[] };
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		const val = () => args[++i] ?? die(t("launch.opt_needs_value", { opt: a }));
		if (a === "-a" || a === "--agent" || a === "-k" || a === "--kind") o.agent = val();
		else if (a === "-w" || a === "--worktree") o.worktree = val();
		else if (a === "-b" || a === "--base") o.base = val();
		else if (a === "-d" || a === "--direction") o.direction = val();
		else if (a === "-r" || a === "--ratio") o.ratio = val();
		else if (a === "-l" || a === "--label") o.label = val();
		else if (a === "--shell") o.shell = true;
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
		} else if (a.startsWith("-")) die(t("launch.unknown_opt", { opt: a }));
		else if (withDir && !o.dirGiven) {
			o.dir = resolve(a);
			o.dirGiven = true;
		} else die(t("launch.unexpected_arg", { arg: a }));
	}
	if (!["right", "down"].includes(o.direction)) die(t("launch.direction_invalid"));
	if (o.base && !o.worktree) die(t("launch.base_needs_worktree"));
	return o;
}

/** Agente a lanzar: el pedido, el del repo, el de bond setup o el primero instalado. */
export async function chooseAgent(asked: string | undefined, repoDefault: string | undefined): Promise<string> {
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
	if (!agent) die(t("launch.no_agents_installed"));
	const kinds = supportedKinds();
	if (kinds.length && !kinds.includes(agent)) die(t("launch.agent_not_supported", { agent, kinds: kinds.join(", ") }));
	// agy fuera del PATH pero en ~/.local/bin vale: preparePane añade su carpeta en el panel.
	if (!which(agent) && !missingAgentDir(agent)) die(t("launch.agent_not_installed", { agent }));
	return agent;
}

export async function launch(args: string[], opts: { dev: boolean }): Promise<void> {
	requireHerdr();
	const o = parseLaunch(args, opts.dev);
	const root = gitRoot(o.dir) ?? o.dir;
	const hasBond = existsSync(join(root, ".bond", "bond.toml"));

	// Repo sin bond: se ofrece init (solo con `bond` a secas y terminal).
	let repoDefault: string | undefined;
	if (!hasBond && !opts.dev && process.stdin.isTTY) {
		const p = await import("@clack/prompts");
		const yes = await p.confirm({ message: t("launch.repo_no_bond", { repo: basename(root) }), initialValue: true });
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
			log(t("launch.config_outdated", { count: pending.length }));
			syncRepo({ quiet: true });
		}
		const { loadRepoDefault } = await import("./repo.mts");
		repoDefault = loadRepoDefault(root);
	}
	const agent = o.noAgent ? undefined : await chooseAgent(o.agent, repoDefault);

	const inside = insideHerdr();
	// Dentro de su propio workspace no hay nada que enfocar: el agente se abre en este panel.
	const here = inside ? process.env.HERDR_WORKSPACE_ID : undefined;
	const label = workspaceLabel(root, o.worktree, o.label);
	if (agent && o.focus && here && workspaceByLabel(label, label.replace(/^bond:/, "pi:")) === here) return runHere(agent, root, o.agentArgs);
	if (!inside) await ensureServer();
	const r = openWorkspace({ dir: root, agent, worktree: o.worktree, base: o.base, label: o.label, shell: o.shell, direction: o.direction, ratio: o.ratio, focus: o.focus, trust: o.trust, agentArgs: o.agentArgs });

	const { renderSmall } = await import("../lib/bond-logo.mts");
	console.log(`\n  ${renderSmall(60, r.reused ? `workspace ${r.label}` : `${agent ?? "shell"} · ${r.label}`)}`);
	if (r.reused) console.log(dim(t("launch.already_open", { ws: r.ws, focused: o.focus ? t("launch.focused") : "" })));
	else {
		console.log(`  workspace ${r.ws}  ${dim(r.cwd)}`);
		if (r.agentName) console.log(t("launch.agent_row", { name: r.agentName, agent: agent ?? "", pane: r.agentPane ?? "", blocked: r.blocked ? caution(t("launch.agent_blocked")) : "" }));
		if (r.shellPane) console.log(`  shell     ${r.shellPane}`);
		if (o.worktree) console.log(dim(t("launch.worktree_done", { ws: r.ws })));
	}
	if (!inside && o.attach) attach();
	if (inside) console.log(ok(o.focus ? t("launch.ready") : t("launch.ready_background")));
	else console.log(dim(t("launch.herdr_attach")));
}

/** El agente en primer plano en el panel actual; al salir, se vuelve a la shell. */
function runHere(agent: string, cwd: string, args: string[]): never {
	const dir = missingAgentDir(agent);
	const env = dir ? { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}` } : process.env;
	// En Windows los agentes suelen ser .cmd: hace falta la shell para lanzarlos.
	const r = spawnSync(agent, args, { stdio: "inherit", cwd, env, shell: process.platform === "win32" });
	if (r.error) die(t("launch.run_failed", { agent, err: r.error.message }));
	process.exit(r.status ?? 0);
}

/** `bond status`: agentes vivos en Herdr. */
export function status(args: string[], cwdFilter?: string): void {
	requireHerdr();
	const list = agents();
	if (args.includes("--json") || args.includes("-j")) return console.log(JSON.stringify(list, null, 2));
	const rows = list
		.filter((a) => !cwdFilter || (a.cwd ?? a.foreground_cwd ?? "").includes(cwdFilter))
		.map((a) => [a.name ?? t("launch.unnamed"), a.agent ?? "?", a.agent_status ?? "?", a.cwd ?? a.foreground_cwd ?? "-", a.pane_id]);
	if (!rows.length) return console.log(cwdFilter ? t("launch.no_agents_repo") : t("launch.no_agents_live"));
	const head = [t("launch.head_agent"), t("launch.head_kind"), t("launch.head_state"), t("launch.head_cwd"), t("launch.head_panel")];
	const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
	for (const r of [head, ...rows]) console.log(r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i]))).join("  "));
}
