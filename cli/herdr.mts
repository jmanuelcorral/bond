// Operaciones de Herdr que usa bond: servidor, workspaces, worktrees, paneles y agentes.
// Herdr responde JSON con los datos bajo .result; los errores, JSON en stderr.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { agyLocalBin } from "./catalog-agents.mts";
import { die, run, which } from "./util.mts";

export interface HerdrAgent {
	name?: string;
	agent?: string;
	agent_status?: string;
	cwd?: string;
	foreground_cwd?: string;
	pane_id: string;
	workspace_id?: string;
	agent_session?: { kind?: string; value?: string };
}

/** Ejecuta `herdr <args>` y devuelve su .result, o lanza con el mensaje de error de Herdr. */
export function herdr<T = Record<string, unknown>>(args: string[], timeout = 120_000): T {
	const r = run("herdr", args, { timeout });
	let parsed: { result?: T; error?: { code?: string; message?: string } } = {};
	try {
		parsed = JSON.parse(r.stdout || r.stderr || "{}");
	} catch {
		// Salida no JSON.
	}
	if (r.status !== 0 || parsed.error) {
		const err = new Error(parsed.error?.message ?? ((r.stderr || r.stdout).trim() || `herdr ${args.join(" ")} falló`)) as Error & { code?: string };
		err.code = parsed.error?.code;
		throw err;
	}
	return (parsed.result ?? {}) as T;
}

export function requireHerdr(): void {
	if (!which("herdr")) die("Herdr no está instalado: https://herdr.dev/docs/install/ (o bond setup)");
}

export const insideHerdr = () => process.env.HERDR_ENV === "1";

export function serverRunning(): boolean {
	return /server:[\s\S]*?status: running/.test(run("herdr", ["status"]).stdout);
}

/** Arranca el servidor de Herdr en segundo plano si no está, y espera a que responda. */
export async function ensureServer(): Promise<void> {
	if (serverRunning()) return;
	spawn("herdr", ["server"], { detached: true, stdio: "ignore" }).unref();
	for (let i = 0; i < 50; i++) {
		await new Promise((r) => setTimeout(r, 200));
		if (serverRunning()) return;
	}
	die("el servidor de Herdr no arrancó (prueba `herdr` a mano)");
}

export function workspaces(): Array<{ workspace_id: string; label?: string }> {
	return herdr<{ workspaces?: Array<{ workspace_id: string; label?: string }> }>(["workspace", "list"]).workspaces ?? [];
}

export const workspaceByLabel = (...labels: string[]) => workspaces().find((w) => w.label && labels.includes(w.label))?.workspace_id;

export function agents(timeout?: number): HerdrAgent[] {
	try {
		return herdr<{ agents?: HerdrAgent[] }>(["agent", "list"], timeout).agents ?? [];
	} catch {
		return [];
	}
}

/**
 * Preguntas que un agente enseña sin que Herdr lo marque como blocked. pi y agy preguntan si
 * confías en la carpeta del proyecto (cada worktree es una carpeta nueva) y Herdr lo da por idle:
 * el Enter del primer prompt elegiría "Trust" por ti y la tarea se perdería.
 */
const QUESTIONS: Array<[RegExp, string]> = [
	[/Trust project folder\?/, "confiar en la carpeta del proyecto"],
	[/Do you trust the contents of this project\?/, "confiar en la carpeta del proyecto"],
];

/** Pregunta conocida en el texto de una pantalla, si la hay. */
export const questionIn = (screen: string) => QUESTIONS.find(([re]) => re.test(screen))?.[1];

/**
 * Aviso de arranque de agy (novedades de la versión, «esc to dismiss»): no es una pregunta,
 * aunque Herdr pueda darlo por blocked; el agente acepta el prompt con él en pantalla.
 */
export const startupNoticeIn = (screen: string) => /esc to dismiss/.test(screen) && !questionIn(screen);

/**
 * Si un agente recién arrancado espera una respuesta tuya: una pregunta conocida en pantalla,
 * o Herdr lo marca blocked (`status`) por algo que no es el aviso de arranque de agy.
 */
export const blockedOnStart = (screen: string, status?: string) => questionIn(screen) !== undefined || (status === "blocked" && !startupNoticeIn(screen));

/** Lo que se ve en el panel del agente ("" si Herdr no lo da). */
export function visibleScreen(agent: string): string {
	const r = run("herdr", ["agent", "read", agent, "--source", "visible", "--lines", "60"], { timeout: 5000 });
	return r.status === 0 ? r.stdout : "";
}

/** Pregunta que espera respuesta en la pantalla del agente, si la hay. */
export const pendingQuestion = (agent: string) => questionIn(visibleScreen(agent));

/** Tras `herdr agent start` (failed: si devolvió error): si el agente espera una respuesta tuya. */
export function startedBlocked(name: string, failed: boolean): boolean {
	return blockedOnStart(visibleScreen(name), failed ? agents().find((a) => a.name === name)?.agent_status : undefined);
}

/**
 * Carpeta que le falta al PATH para lanzar un agente: el instalador de agy lo deja en
 * ~/.local/bin, que no siempre está en el PATH de las shells no interactivas (ni en el de
 * los paneles de Herdr). undefined si el agente está en el PATH o no está ahí.
 */
export function missingAgentDir(agent: string, find: (cmd: string) => string | undefined = which, local = agyLocalBin()): string | undefined {
	if (agent !== "agy" || find("agy") || !existsSync(local)) return undefined;
	return dirname(local);
}

/**
 * `herdr agent start` teclea el ejecutable sin ruta en la shell del panel: si no está en el
 * PATH, antes se añade su carpeta al PATH de esa shell (sh, bash, zsh). En Windows no.
 */
export function preparePane(pane: string, agent: string): void {
	const dir = missingAgentDir(agent);
	if (!dir || process.platform === "win32") return;
	run("herdr", ["pane", "run", pane, `export PATH='${dir.replace(/'/g, "'\\''")}':"$PATH"`]);
}

/**
 * Argumentos con los que bond team y bond-delegate lanzan un agente: los tuyos tras `--` o,
 * sin ellos, agy sin pedir permiso por cada comando (A5: si no, se para en cada uno).
 */
export const defaultAgentArgs = (agent: string, given: string[]) => (given.length ? given : agent === "agy" ? ["--dangerously-skip-permissions"] : []);

/** Kinds de agente que admite la versión instalada de Herdr. */
export function supportedKinds(): string[] {
	const help = run("herdr", ["agent", "start", "--help"]).stdout;
	return (/possible values: ([^\]]+)\]/.exec(help)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function focusWorkspace(id: string): void {
	herdr(["workspace", "focus", id]);
}

/** Engancha la interfaz de Herdr a esta terminal (sustituye a bond hasta que salgas). */
export function attach(): never {
	const r = spawnSync("herdr", [], { stdio: "inherit" });
	process.exit(r.status ?? 0);
}

/** Nombre de agente válido para Herdr: [a-z][a-z0-9_-]{0,31}. */
export const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** Primer nombre libre entre los agentes vivos: base, base-2, base-3... */
export function uniqueAgentName(base: string): string {
	return firstFreeName(base, new Set(agents().map((a) => a.name).filter((n): n is string => !!n)));
}

/** Primer nombre que no está en `live`: base, base-2, base-3... (válido para Herdr). */
export function firstFreeName(base: string, live: Set<string>): string {
	let name = base.slice(0, 29).replace(/-+$/, "");
	if (!/^[a-z]/.test(name)) name = `a-${name}`.slice(0, 29);
	const root = name;
	for (let n = 2; live.has(name); n++) name = `${root}-${n}`;
	return name;
}
