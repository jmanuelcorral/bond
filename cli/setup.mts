// `bond setup`: deja la máquina lista. Mismos pasos que hacía install.sh, más el enlace de
// `bond` en el PATH. Idempotente: se puede relanzar tras cada cambio en el repo.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderSmall } from "../lib/bond-logo.mts";
import { assetsPath, FROM_SOURCE } from "./runtime.mts";
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

Deja la máquina lista para BOND: instala pi si falta, enlaza su configuración a este repo,
registra el paquete de pi, deja un único skill de Herdr, instala la integración de Herdr y
pone \`bond\` en el PATH. Se puede relanzar tras cada cambio.

  --no-pi          No instala el CLI de pi (solo configuración e integración)
  --herdr-config   Añade el snippet de Herdr a ~/.config/herdr/config.toml
  --dry-run        Muestra lo que haría sin tocar nada
  -h, --help       Esta ayuda`;

const HERDR_MARKER = ">>> bond >>>";
// Marca de antes del renombrado: si ya está en config.toml, el bloque no se vuelve a añadir.
const OLD_HERDR_MARKER = ">>> piSetup >>>";

export async function setup(args: string[]): Promise<void> {
	let withPi = true;
	let withHerdrConfig = false;
	for (const a of args) {
		if (a === "--no-pi") withPi = false;
		else if (a === "--herdr-config") withHerdrConfig = true;
		else if (a === "--dry-run") continue; // lo trata main
		else die(`opción desconocida: ${a} (bond setup --help)`);
	}

	// Requisitos.
	if (!which("herdr")) die("herdr no está en el PATH. Instálalo en https://herdr.dev/docs/install/");
	log(`herdr ${run("herdr", ["--version"]).stdout.trim().split(/\s+/).pop() ?? "?"}`);

	installPi(withPi);
	if (FROM_SOURCE) installDeps();
	linkPiConfig();
	herdrSkill();
	globalSkills();
	if (FROM_SOURCE) gitFilter();
	contextTools();
	herdrIntegrations();
	if (withHerdrConfig) herdrConfig();
	await modelsStep();
	if (FROM_SOURCE) linkBond();

	log("Listo");
	console.log(`
  ${renderSmall(60, "licence to code")}

  Config de pi:   ${AGENT_DIR}
  Paquete pi:     ${AGENT_DIR}/bond -> ${assetsPath()}
  Modelos:        ~/.config/bond/config.toml  -> bond models list | probe | sync
  MCP:            context7, duckduckgo  -> pi mcp list
  Comprobar todo: bond doctor

  Primer paso: arranca pi (pi o bond dev) y ejecuta /login para configurar proveedor y modelo.
  Tras tocar esta config en caliente, usa /reload dentro de pi.`);
}

function installPi(withPi: boolean): void {
	if (withPi) {
		if (which("pi")) log(`pi ya instalado: ${which("pi")}`);
		else if (which("bun")) {
			log("Instalando pi con bun (a nivel de usuario, sin sudo)...");
			runAct("bun", ["add", "-g", "@earendil-works/pi-coding-agent"]);
		} else if (which("npm")) {
			const prefix = process.env.NPM_GLOBAL_PREFIX || join(HOME, ".npm-global");
			log(`Instalando pi con npm en ${prefix} (sin sudo)...`);
			runAct("npm", ["install", "-g", "--ignore-scripts", "--prefix", prefix, "@earendil-works/pi-coding-agent"]);
			warn(`Añade ${prefix}/bin al PATH si no lo está ya.`);
		} else die("No encuentro ni bun ni npm para instalar pi.");
	}
	if (!isDryRun() && !which("pi")) die("pi sigue sin estar en el PATH tras la instalación; revisa PATH y reintenta.");
}

/** Dependencias de la CLI (smol-toml): node_modules del repo, desde package-lock.json. */
function installDeps(): void {
	if (existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) return;
	log("Instalando las dependencias de bond (npm ci, sin scripts)");
	if (which("npm")) runAct("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: REPO_DIR });
	else if (which("bun")) runAct("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: REPO_DIR });
	else die("hace falta npm o bun para instalar las dependencias de bond");
}

/** Registro global de modelos: lo crea si falta (importando el models.json de pi) y sincroniza pi. */
async function modelsStep(): Promise<void> {
	if (isDryRun() && !existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) {
		console.log("    [dry-run] bond models init && bond models sync --agent pi");
		return;
	}
	const m = await import("./models.mts");
	log("Modelos globales");
	m.init();
	if (!isDryRun()) m.syncAgents({ agents: ["pi"] });
	else console.log("    [dry-run] bond models sync --agent pi");
	log("otros agentes (opencode, crush, codex): bond models sync");
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

function herdrIntegrations(): void {
	// Con la integración, cada agente le cuenta a Herdr su estado real (working, blocked, done)
	// en vez de que Herdr lo adivine mirando la pantalla. Solo para los agentes instalados.
	log("Integraciones de Herdr");
	for (const { agent, state } of herdrIntegrationStatus()) {
		if (!which(agent)) continue;
		if (state.startsWith("current")) log(`integración ${agent}: ya actual`);
		else runAct("herdr", ["integration", "install", agent]);
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
