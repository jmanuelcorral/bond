// `bond doctor`: comprueba que la máquina está como la deja `bond setup` y que lo que depende
// de fuera (Herdr, MCP, la pasarela de modelos) responde. Sale con 1 si algo falla.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { assetsPath, FROM_SOURCE } from "./runtime.mts";
import { CONTEXT_TOOLS, globalSkillsDir, globalSkillTargets, herdrIntegrationStatus, PI_HERDR_SKILL, SHARED_HERDR_SKILL } from "./setup.mts";
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
	// Integración de Herdr de cada agente instalado: pi es obligatoria; las demás, aviso.
	const states = herdrIntegrationStatus().filter((s) => which(s.agent));
	const current = states.filter((s) => s.state.startsWith("current")).map((s) => s.agent);
	if (current.length) add("ok", "integraciones herdr", current.join(", "));
	for (const s of states.filter((x) => !x.state.startsWith("current"))) {
		add(s.agent === "pi" ? "fail" : "warn", `integración herdr-${s.agent}`, s.state, "bond setup");
	}
}

function checkPi(): void {
	if (!which("pi")) return add("fail", "pi", "no está en el PATH", "bond setup");
	add("ok", "pi", run("pi", ["--version"]).stdout.trim());
	for (const f of FROM_SOURCE ? ["settings.json", "AGENTS.md", "mcp.json"] : []) {
		const dest = join(AGENT_DIR, f);
		const src = join(REPO_DIR, "pi", "agent", f);
		if (linkTarget(dest) && samePath(dest, src)) add("ok", `enlace ${f}`, `-> repo`);
		else add("fail", `enlace ${f}`, existsSync(dest) ? "existe pero no apunta al repo" : "no existe", "bond setup");
	}
	const pkg = join(AGENT_DIR, "bond");
	if (linkTarget(pkg) && samePath(pkg, assetsPath())) add("ok", "paquete pi", `~/.pi/agent/bond -> ${FROM_SOURCE ? "repo" : "runtime"}`);
	else add("fail", "paquete pi", "falta el enlace ~/.pi/agent/bond", "bond setup");
	if (!/\.\/bond\b/.test(run("pi", ["list"]).stdout)) add("fail", "paquete pi en settings", "pi list no muestra ./bond", "revisa pi/agent/settings.json");
	if (linkTarget(join(AGENT_DIR, "pisetup")) !== undefined) add("warn", "enlace antiguo", "~/.pi/agent/pisetup (de antes del renombrado)", "bond setup");
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

function checkGlobalSkills(): void {
	const missing: string[] = [];
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name)) if (!(linkTarget(dest) && samePath(dest, join(globalSkillsDir(), name)))) missing.push(dest.replace(process.env.HOME ?? "", "~"));
	}
	if (missing.length) add("fail", "skills globales", `faltan: ${missing.join(", ")}`, "bond setup");
	else add("ok", "skills globales", `${readdirSync(globalSkillsDir()).join(", ")} (~/.agents/skills, ~/.claude/skills)`);
}

function checkGitFilter(): void {
	if (!FROM_SOURCE) return;
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

/** Registro global de modelos: config, sincronía con cada agente y que las pasarelas respondan. */
async function checkModels(): Promise<void> {
	if (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) {
		return add("fail", "dependencias", "falta node_modules (smol-toml)", "bond setup");
	}
	const { CONFIG_FILE, activeProviders, loadConfig } = await import("./config.mts");
	if (!existsSync(CONFIG_FILE)) return add("fail", "modelos", `no existe ${CONFIG_FILE}`, "bond models init");
	const { syncAgents } = await import("./models.mts");
	const stale = syncAgents({ check: true, quiet: true });
	if (stale.includes("pi")) add("fail", "modelos pi", "desfasado respecto a config.toml", "bond models sync --agent pi");
	else add("ok", "modelos pi", "al día con config.toml");
	const others = stale.filter((a) => a !== "pi");
	if (others.length) add("warn", "modelos otros agentes", `desfasados: ${others.join(", ")}`, "bond models sync");

	for (const p of activeProviders(loadConfig())) {
		try {
			const key = p.api_key_env ? process.env[p.api_key_env] : undefined;
			const res = await fetch(`${p.base_url.replace(/\/$/, "")}/models`, {
				headers: key ? { authorization: `Bearer ${key}` } : {},
				signal: AbortSignal.timeout(10_000),
			});
			const served = new Set(((await res.json()) as { data?: Array<{ id: string }> }).data?.map((m) => m.id) ?? []);
			const declared = p.models.map((m) => m.id);
			const missing = declared.filter((m) => !served.has(m));
			if (missing.length) add("warn", `pasarela ${p.id}`, `no lista: ${missing.join(", ")}`);
			else add("ok", `pasarela ${p.id}`, `${p.base_url} sirve ${declared.join(", ")}`);
		} catch (e) {
			add("fail", `pasarela ${p.id}`, `${p.base_url} no responde (${(e as Error).message})`);
		}
	}
}

/** Si se ejecuta dentro de un repo con .bond/, comprueba que su config de agentes está al día. */
async function checkRepo(): Promise<void> {
	const top = run("git", ["rev-parse", "--show-toplevel"]);
	const root = top.status === 0 ? top.stdout.trim() : process.cwd();
	if (!existsSync(join(root, ".bond", "bond.toml")) || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return;
	const { syncRepo } = await import("./repo.mts");
	const actions = syncRepo({ check: true, quiet: true });
	const conflicts = actions.filter((a) => a.sign === "!").length;
	if (!actions.length) add("ok", "repo", `${root}: config de agentes al día`);
	else add(conflicts ? "fail" : "warn", "repo", `${root}: ${actions.length} cambio(s) pendiente(s)${conflicts ? `, ${conflicts} conflicto(s)` : ""}`, "bond sync");
}

function checkBond(): void {
	const p = which("bond");
	if (!FROM_SOURCE) return add(p ? "ok" : "warn", "bond en el PATH", p ?? "no está (instálalo con tu gestor de paquetes)");
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
	checkGlobalSkills();
	checkGitFilter();
	checkTools();
	if (!quick) checkMcp();
	await checkModels();
	await checkRepo();
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
