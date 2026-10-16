// `bond doctor`: comprueba que la máquina está como la deja `bond setup` y que lo que depende
// de fuera (Herdr, MCP, la pasarela de modelos) responde. Sale con 1 si algo falla.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTEXT_TOOLS, PI_HERDR_SKILL, SHARED_HERDR_SKILL } from "./setup.mts";
import { AGENT_DIR, bad, caution, die, dim, linkTarget, ok, REPO_DIR, run, samePath, which } from "./util.mts";

export const DOCTOR_HELP = `Uso: bond doctor [--quick]

Comprueba la instalación global: Node, Herdr, pi, enlaces de configuración, paquete de pi,
skill de Herdr, integración, filtro de git, herramientas de contexto, servidores MCP y la
pasarela de modelos. Sale con 1 si algo falla.

  --quick      Se salta lo lento (conectar los servidores MCP)
  -h, --help   Esta ayuda`;

type Level = "ok" | "warn" | "fail";
interface Check {
	level: Level;
	name: string;
	detail: string;
	fix?: string;
}

const results: Check[] = [];
const add = (level: Level, name: string, detail: string, fix?: string) => results.push({ level, name, detail, fix });

function checkNode(): void {
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (major > 22 || (major === 22 && minor >= 18)) add("ok", "node", process.versions.node);
	else add("fail", "node", `${process.versions.node}: hace falta 22.18 o más (TypeScript sin compilar)`);
}

function checkHerdr(): void {
	if (!which("herdr")) return add("fail", "herdr", "no está en el PATH", "https://herdr.dev/docs/install/");
	const status = run("herdr", ["status"]).stdout;
	const client = /client:[\s\S]*?version: (\S+)/.exec(status)?.[1] ?? "?";
	const running = /server:[\s\S]*?status: running/.test(status);
	add(running ? "ok" : "warn", "herdr", `${client}${running ? ", servidor en marcha" : ", servidor parado"}`, running ? undefined : "herdr (lo arranca)");
	const integration = run("herdr", ["integration", "status"]).stdout;
	if (/^pi: current/m.test(integration)) add("ok", "integración herdr-pi", "current");
	else add("fail", "integración herdr-pi", integration.split("\n").find((l) => l.startsWith("pi:")) ?? "no instalada", "bond setup");
}

function checkPi(): void {
	if (!which("pi")) return add("fail", "pi", "no está en el PATH", "bond setup");
	add("ok", "pi", run("pi", ["--version"]).stdout.trim());
	for (const f of ["settings.json", "models.json", "AGENTS.md", "mcp.json"]) {
		const dest = join(AGENT_DIR, f);
		const src = join(REPO_DIR, "pi", "agent", f);
		if (linkTarget(dest) && samePath(dest, src)) add("ok", `enlace ${f}`, `-> repo`);
		else add("fail", `enlace ${f}`, existsSync(dest) ? "existe pero no apunta al repo" : "no existe", "bond setup");
	}
	const pkg = join(AGENT_DIR, "pisetup");
	if (linkTarget(pkg) && samePath(pkg, REPO_DIR)) add("ok", "paquete pi", "~/.pi/agent/pisetup -> repo");
	else add("fail", "paquete pi", "falta el enlace ~/.pi/agent/pisetup", "bond setup");
	if (!/\.\/pisetup/.test(run("pi", ["list"]).stdout)) add("fail", "paquete pi en settings", "pi list no muestra ./pisetup", "revisa pi/agent/settings.json");
	if (linkTarget(join(AGENT_DIR, "prompts"))) add("warn", "prompts antiguos", "~/.pi/agent/prompts sigue enlazado (duplica comandos)", "bond setup");
}

function checkHerdrSkill(): void {
	const shared = existsSync(SHARED_HERDR_SKILL);
	const mine = existsSync(PI_HERDR_SKILL);
	if (shared && mine) return add("fail", "skill herdr", "duplicado en ~/.agents/skills y ~/.pi/agent/skills", "bond setup");
	if (!shared && !mine) return add("fail", "skill herdr", "no está instalado", "bond setup");
	const file = shared ? SHARED_HERDR_SKILL : PI_HERDR_SKILL;
	const fresh = which("herdr") ? run("herdr", ["--skill"]).stdout.trimEnd() : "";
	if (fresh && readFileSync(file, "utf8").trimEnd() !== fresh) {
		add("warn", "skill herdr", `${shared ? "compartido" : "de pi"}, desfasado respecto a 'herdr --skill'`, shared ? "npx skills update herdr" : "bond setup");
	} else add("ok", "skill herdr", shared ? "compartido (~/.agents/skills)" : "de pi");
}

function checkGitFilter(): void {
	if (run("git", ["-C", REPO_DIR, "rev-parse", "--git-dir"]).status !== 0) return add("warn", "filtro git", "el repo no es un repo git");
	const v = run("git", ["-C", REPO_DIR, "config", "--get", "filter.pi-settings.clean"]).stdout.trim();
	if (v === "scripts/git-clean-settings") add("ok", "filtro git", "pi-settings registrado");
	else add("fail", "filtro git", "pi-settings sin registrar", "bond setup");
}

function checkTools(): void {
	const missing = CONTEXT_TOOLS.filter(([c]) => !which(c));
	if (missing.length === 0) add("ok", "herramientas", CONTEXT_TOOLS.map(([c]) => c).join(" "));
	for (const [c, why] of missing) add("warn", `herramienta ${c}`, `falta (${why})`);
}

function checkMcp(): void {
	if (!which("pi")) return;
	const r = run("pi", ["mcp", "list"], { timeout: 120_000 });
	for (const m of r.stdout.matchAll(/^(\S+): (connected|[^\n]+)$/gm)) {
		const [, name, state] = m;
		add(state.startsWith("connected") ? "ok" : "fail", `mcp ${name}`, state, state.startsWith("connected") ? undefined : "pi mcp list");
	}
	if (r.status !== 0 && !/connected/.test(r.stdout)) add("fail", "mcp", r.stderr.trim().split("\n")[0] || "pi mcp list falló");
}

/** models.json admite comentarios //: se quitan las líneas que solo son comentario. */
function readModels(): { providers?: Record<string, { baseUrl?: string; models?: Array<{ id: string }> }> } {
	try {
		const text = readFileSync(join(REPO_DIR, "pi", "agent", "models.json"), "utf8");
		return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
	} catch {
		return {};
	}
}

async function checkModels(): Promise<void> {
	for (const [id, p] of Object.entries(readModels().providers ?? {})) {
		if (!p.baseUrl) continue;
		try {
			const res = await fetch(`${p.baseUrl.replace(/\/$/, "")}/models`, { signal: AbortSignal.timeout(10_000) });
			const served = new Set(((await res.json()) as { data?: Array<{ id: string }> }).data?.map((m) => m.id) ?? []);
			const declared = (p.models ?? []).map((m) => m.id);
			const missing = declared.filter((m) => !served.has(m));
			if (missing.length) add("warn", `modelos ${id}`, `la pasarela no lista: ${missing.join(", ")}`);
			else add("ok", `modelos ${id}`, `${p.baseUrl} sirve ${declared.join(", ")}`);
		} catch (e) {
			add("fail", `modelos ${id}`, `${p.baseUrl} no responde (${(e as Error).message})`);
		}
	}
}

function checkBond(): void {
	const p = which("bond");
	if (p && samePath(p, join(REPO_DIR, "bin", "bond"))) add("ok", "bond en el PATH", p);
	else if (p) add("warn", "bond en el PATH", `${p} no es el de este repo`);
	else add("warn", "bond en el PATH", "no está", "bond setup");
}

export async function doctor(args: string[]): Promise<void> {
	const quick = args.includes("--quick");
	for (const a of args) if (a !== "--quick") die(`opción desconocida: ${a} (bond doctor --help)`);

	checkNode();
	checkHerdr();
	checkPi();
	checkHerdrSkill();
	checkGitFilter();
	checkTools();
	if (!quick) checkMcp();
	await checkModels();
	checkBond();

	const mark = { ok: ok("✓"), warn: caution("!"), fail: bad("✗") };
	const width = Math.max(...results.map((r) => r.name.length));
	for (const r of results) {
		console.log(`${mark[r.level]} ${r.name.padEnd(width)}  ${r.detail}${r.fix ? dim(`  → ${r.fix}`) : ""}`);
	}
	const fails = results.filter((r) => r.level === "fail").length;
	const warns = results.filter((r) => r.level === "warn").length;
	console.log(`\n${fails ? bad(`${fails} fallo(s)`) : ok("sin fallos")}${warns ? `, ${caution(`${warns} aviso(s)`)}` : ""}${quick ? dim(" (sin MCP: --quick)") : ""}`);
	if (fails) process.exitCode = 1;
}
