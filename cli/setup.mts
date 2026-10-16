// `bond setup`: deja la máquina lista. Mismos pasos que hacía install.sh, más el enlace de
// `bond` en el PATH. Idempotente: se puede relanzar tras cada cambio en el repo.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderSmall } from "../lib/bond-logo.mts";
import { assetsPath, ensureBondLink, FROM_SOURCE } from "./runtime.mts";
import {
	act,
	AGENT_DIR,
	die,
	exists,
	HOME,
	isDryRun,
	linkPath,
	linkTarget,
	log,
	REPO_DIR,
	run,
	runAct,
	samePath,
	brokenLink,
	warn,
	which,
} from "./util.mts";

export const SETUP_HELP = `Uso: bond setup [opciones]

Configura bond en esta máquina (una vez; se puede repetir para cambiar algo):

  1. Herdr: si falta, explica cómo instalarlo.
  2. Endpoints de modelos: detecta Ollama y LM Studio y pregunta por otros (OpenAI o
     compatibles con OpenAI). Las claves se guardan en ~/.bond/keys (permisos 600).
  3. Agentes: con cuáles trabajar (de los instalados; hace falta al menos uno) y cuál por
     defecto.
  4. Aplica: modelos en cada agente, integraciones de Herdr, skills globales y tus
     instrucciones (~/.bond/AGENTS.md) en cada agente.

  --yes            Sin preguntas: usa lo detectado y lo ya configurado
  --herdr-config   Añade el snippet de Herdr a ~/.config/herdr/config.toml
  --dry-run        Pregunta, pero solo enseña lo que haría al aplicar
  -h, --help       Esta ayuda`;

const HERDR_MARKER = ">>> bond >>>";
// Marca de antes del renombrado: si ya está en config.toml, el bloque no se vuelve a añadir.
const OLD_HERDR_MARKER = ">>> piSetup >>>";

export async function setup(args: string[]): Promise<void> {
	let withHerdrConfig = false;
	let yes = false;
	for (const a of args) {
		if (a === "--herdr-config") withHerdrConfig = true;
		else if (a === "--yes" || a === "-y") yes = true;
		else if (a === "--dry-run" || a === "--no-pi") continue; // --dry-run lo trata main; --no-pi ya no hace falta
		else die(`opción desconocida: ${a} (bond setup --help)`);
	}
	// Desde el repo, las dependencias (prompts, TOML) se instalan antes de cargar el asistente.
	if (FROM_SOURCE) installDeps();
	const { runWizard } = await import("./wizard.mts");
	const { saveConfig, configExists } = await import("./config.mts");
	const { init: importLegacyModels } = await import("./models.mts");
	// Instalación anterior desde el repo: sus modelos de pi pasan al registro global.
	if (FROM_SOURCE && !configExists()) importLegacyModels();

	const interactive = !yes && process.stdin.isTTY === true;
	const result = await runWizard({ interactive, logo: renderSmall(56, "setup") });
	if (!result) {
		process.exitCode = 1;
		return;
	}
	const { cfg, herdr } = result;
	const agents = cfg.agents;
	if (!isDryRun()) saveConfig(cfg);

	const { ensurePersonal, propagate, PERSONAL_FILE } = await import("./instructions.mts");
	log("Aplicando");
	if (agents.includes("pi")) {
		linkPiConfig();
		if (!isDryRun()) log(`Bond Extensions de pi: ${await ensureBondLink()} (los repos las cargan con bond init)`);
	}
	if (herdr) herdrSkill();
	globalSkills();
	if (FROM_SOURCE) gitFilter();
	contextTools();
	if (herdr) herdrIntegrations(agents);
	if (withHerdrConfig && herdr) herdrConfig();
	const { syncAgents } = await import("./models.mts");
	if (!isDryRun() && cfg.providers.length) syncAgents({ agents: agents.filter((a) => ["pi", "opencode", "crush", "codex"].includes(a)) });
	ensurePersonal();
	for (const r of propagate(agents)) log(`instrucciones ${r.agent}: ${r.result}${r.why ? ` (${r.why})` : ""}  ${r.file}`);
	if (FROM_SOURCE) linkBond();

	const { CONFIG_FILE } = await import("./config.mts");
	console.log(`
  ${renderSmall(60, "listo")}

  Agentes:        ${agents.join(", ")}  (por defecto: ${cfg.default_agent})
  Endpoints:      ${cfg.providers.map((x) => x.id).join(", ") || "ninguno (cada agente usa su proveedor)"}
  Configuración:  ${CONFIG_FILE}
  Instrucciones:  ${PERSONAL_FILE}  (edítalas y repite bond setup para propagarlas)
  Comprobar:      bond doctor

  Siguiente: cd <tu-repo> && bond init`);
}

/** Dependencias de la CLI (smol-toml): node_modules del repo, desde package-lock.json. */
function installDeps(): void {
	if (existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) return;
	log("Instalando las dependencias de bond (npm ci, sin scripts)");
	if (which("npm")) runAct("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: REPO_DIR });
	else if (which("bun")) runAct("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: REPO_DIR });
	else die("hace falta npm o bun para instalar las dependencias de bond");
}

function linkPiConfig(): void {
	log(`Config de pi en ${AGENT_DIR}`);
	act(`mkdir -p ${AGENT_DIR}/extensions`, () => mkdirSync(join(AGENT_DIR, "extensions"), { recursive: true }));
	// Config personal de pi enlazada desde el repo: solo desde el código fuente (en la 1.0 la
	// genera bond; ver docs/plan-v1.md). models.json lo genera `bond models sync`.
	if (FROM_SOURCE) {
		for (const f of ["settings.json", "AGENTS.md", "mcp.json"]) {
			linkPath(join(REPO_DIR, "pi", "agent", f), join(AGENT_DIR, f));
		}
	}
	// El repo es un paquete de pi; settings.json lo declara como "./bond", relativo a
	// AGENT_DIR, así que el repo puede vivir en cualquier ruta: solo cambia este symlink.
	linkPath(assetsPath(), join(AGENT_DIR, "bond"));
	// Antes del renombrado el enlace se llamaba "pisetup": con los dos, pi cargaría el paquete dos veces.
	const oldPkg = join(AGENT_DIR, "pisetup");
	if (linkTarget(oldPkg) !== undefined) {
		log(`quitando el enlace antiguo ${oldPkg}`);
		act(`rm ${oldPkg}`, () => rmSync(oldPkg));
	}

	// Migración: antes prompts/ se enlazaba suelto; con el paquete duplicaría los comandos.
	const oldPrompts = join(AGENT_DIR, "prompts");
	const target = linkTarget(oldPrompts);
	if (target === join(REPO_DIR, "pi", "agent", "prompts") || target === join(REPO_DIR, "prompts")) {
		log(`quitando el symlink antiguo ${oldPrompts} (ahora llega por el paquete)`);
		act(`rm ${oldPrompts}`, () => rmSync(oldPrompts));
	}
}

export const SHARED_HERDR_SKILL = join(HOME, ".agents", "skills", "herdr", "SKILL.md");
export const PI_HERDR_SKILL = join(AGENT_DIR, "skills", "herdr", "SKILL.md");

function herdrSkill(): void {
	// pi lee skills de ~/.pi/agent/skills y de ~/.agents/skills: con el mismo nombre en las
	// dos hay colisión, así que solo debe existir uno.
	const fresh = run("herdr", ["--skill"]).stdout.trimEnd();
	if (existsSync(SHARED_HERDR_SKILL)) {
		const shared = readFileSync(SHARED_HERDR_SKILL, "utf8").trimEnd();
		log(`skill de Herdr: uso el compartido ${SHARED_HERDR_SKILL}`);
		if (shared !== fresh) {
			warn("el skill compartido no coincide con 'herdr --skill' de la versión instalada;");
			warn(`actualízalo con: npx skills update herdr (o herdr --skill > ${SHARED_HERDR_SKILL})`);
		}
		if (existsSync(PI_HERDR_SKILL)) {
			const mine = readFileSync(PI_HERDR_SKILL, "utf8").trimEnd();
			// Solo se borra si es la copia que generaba el instalador; si la editaste, se avisa.
			if (mine === fresh || mine === shared) {
				log(`quitando la copia duplicada ${dirname(PI_HERDR_SKILL)}`);
				act(`rm -r ${dirname(PI_HERDR_SKILL)}`, () => rmSync(dirname(PI_HERDR_SKILL), { recursive: true }));
			} else warn(`${PI_HERDR_SKILL} tiene cambios locales y colisiona con el compartido; revísalo a mano`);
		}
	} else {
		log("Instalando el skill de Herdr en pi");
		act(`herdr --skill > ${PI_HERDR_SKILL}`, () => {
			mkdirSync(dirname(PI_HERDR_SKILL), { recursive: true });
			writeFileSync(PI_HERDR_SKILL, `${fresh}\n`);
		});
	}
}

function gitFilter(): void {
	// pi escribe lastChangelogVersion en settings.json (symlink a este repo); el filtro
	// pi-settings (.gitattributes) lo quita al hacer `git add`.
	if (run("git", ["-C", REPO_DIR, "rev-parse", "--git-dir"]).status !== 0) return;
	if (run("git", ["-C", REPO_DIR, "config", "--get", "filter.pi-settings.clean"]).stdout.trim() !== "scripts/git-clean-settings") {
		log("registrando el filtro de git pi-settings");
		runAct("git", ["-C", REPO_DIR, "config", "filter.pi-settings.clean", "scripts/git-clean-settings"]);
	}
}

export const CONTEXT_TOOLS: Array<[string, string]> = [
	["rg", "ripgrep: tool grep de pi"],
	["fd", "tool find de pi"],
	["ast-grep", "skill code-context: bun add -g @ast-grep/cli@0.45.3"],
	["uvx", "uv: servidor MCP web"],
	["jq", "pidev, pistatus, filtro de git"],
];

function contextTools(): void {
	// No se instalan aquí (son paquetes de sistema o globales): se avisa.
	const missing = CONTEXT_TOOLS.filter(([cmd]) => !which(cmd));
	if (missing.length === 0) log(`herramientas de contexto: ${CONTEXT_TOOLS.map(([c]) => c).join(" ")}`);
	for (const [cmd, why] of missing) warn(`falta ${cmd} (${why})`);
}

/** Skills globales (bond-delegate, bond-team): del repo o extraídos del binario. */
export const globalSkillsDir = () => assetsPath("global", "skills");

/** Destinos de los skills globales: ~/.agents/skills (pi, Codex, Copilot, opencode, Crush, Gemini) y ~/.claude/skills (Claude Code). */
export function globalSkillTargets(name: string): string[] {
	return [join(HOME, ".agents", "skills", name), join(HOME, ".claude", "skills", name)];
}

function globalSkills(): void {
	// bond-delegate y bond-team son de Herdr, una herramienta de la máquina: van a nivel de
	// usuario, como el skill herdr, para cualquier agente y en cualquier repo.
	log("Skills globales de bond (multiagente con Herdr)");
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name)) {
			act(`mkdir -p ${dirname(dest)}`, () => mkdirSync(dirname(dest), { recursive: true }));
			linkPath(join(globalSkillsDir(), name), dest);
		}
	}
}

/** Integraciones de Herdr: estado por agente según `herdr integration status`. */
export function herdrIntegrationStatus(): Array<{ agent: string; state: string }> {
	return [...run("herdr", ["integration", "status"]).stdout.matchAll(/^([a-z0-9_-]+): (.+?)(?: \(|$)/gm)].map((m) => ({ agent: m[1], state: m[2] }));
}

function herdrIntegrations(agents: string[]): void {
	// Con la integración, cada agente le cuenta a Herdr su estado real (working, blocked, done)
	// en vez de que Herdr lo adivine mirando la pantalla. Solo para los agentes instalados.
	log("Integraciones de Herdr");
	for (const { agent, state } of herdrIntegrationStatus()) {
		if (!which(agent) || !agents.includes(agent)) continue;
		if (state.startsWith("current")) {
			log(`integración ${agent}: ya actual`);
			continue;
		}
		// Herdr se niega si el agente aún no creó su carpeta de config (nunca se ha abierto):
		// es un aviso, no un error; se instala en el siguiente bond setup.
		act(`herdr integration install ${agent}`, () => {
			const r = run("herdr", ["integration", "install", agent]);
			if (r.status === 0) log(`integración ${agent}: instalada`);
			else warn(`integración ${agent}: ${(r.stderr || r.stdout).trim().split("\n").pop()} (abre ${agent} una vez y repite bond setup)`);
		});
	}
}

function herdrConfig(): void {
	const file = join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "herdr", "config.toml");
	if (existsSync(file) && [HERDR_MARKER, OLD_HERDR_MARKER].some((m) => readFileSync(file, "utf8").includes(m))) {
		warn(`${file} ya tiene el bloque de bond; no lo duplico.`);
		warn("Para cambiarlo, edita herdr/config.snippet.toml y reemplaza el bloque a mano.");
		return;
	}
	log(`Añadiendo el snippet de Herdr a ${file}`);
	act(`cat herdr/config.snippet.toml >> ${file}`, () => {
		mkdirSync(dirname(file), { recursive: true });
		const snippet = readFileSync(assetsPath("herdr", "config.snippet.toml"), "utf8");
		appendFileSync(file, `\n${HERDR_MARKER}\n${snippet}# <<< bond <<<\n`);
		if (run("herdr", ["server", "reload-config"]).status !== 0) {
			warn("Servidor de Herdr no recargó la config (¿no está en marcha?). Reinícialo tú.");
		}
	});
}

/** Directorios del PATH donde enlazar `bond`, por preferencia. */
export function bondLinkDirs(): string[] {
	const path = (process.env.PATH ?? "").split(":");
	return [join(HOME, ".local", "bin"), join(HOME, "bin"), join(HOME, ".bun", "bin")].filter((d) => path.includes(d));
}

function linkBond(): void {
	const src = join(REPO_DIR, "bin", "bond");
	const current = which("bond");
	if (current && samePath(current, src)) {
		log(`bond en el PATH: ${current}`);
		return;
	}
	if (current) {
		warn(`hay otro 'bond' en el PATH (${current}); no lo toco. Usa ${src}`);
		return;
	}
	const dir = bondLinkDirs()[0];
	if (!dir) {
		warn(`ninguno de ~/.local/bin, ~/bin o ~/.bun/bin está en el PATH; añade ${join(REPO_DIR, "bin")} al PATH`);
		return;
	}
	const dest = join(dir, "bond");
	if (exists(dest) && !brokenLink(dest)) {
		warn(`${dest} existe y no es este bond; no lo toco`);
		return;
	}
	// Un enlace roto (p. ej. tras mover el repo) se sustituye.
	if (brokenLink(dest)) act(`rm ${dest}`, () => rmSync(dest));
	act(`ln -s ${src} ${dest}`, () => symlinkSync(src, dest));
	log(`bond en el PATH: ${dest} -> ${src}`);
}
