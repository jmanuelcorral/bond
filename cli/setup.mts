// `bond setup`: deja la máquina lista: Herdr, endpoints de modelos, agentes elegidos, skills
// globales e instrucciones personales en cada agente. Idempotente: se puede repetir.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderSmall } from "../lib/bond-logo.mts";
import { agyPluginDir } from "./catalog-agents.mts";
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
	copyPath,
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
  4. Aplica: modelos en cada agente, sugerencias de prompt en pi, integraciones de Herdr,
     skills globales y tus instrucciones (~/.bond/AGENTS.md) en cada agente (en
     Antigravity, en un plugin global: ~/.gemini/config/plugins/bond).

  --yes            Sin preguntas: usa lo detectado y lo ya configurado
  --no-suggestions No activar las sugerencias de prompt de pi
  --herdr-config   Añade el snippet de Herdr a ~/.config/herdr/config.toml
  --dry-run        Pregunta, pero solo enseña lo que haría al aplicar
  -h, --help       Esta ayuda`;

const HERDR_MARKER = ">>> bond >>>";
// Marca de antes del renombrado: si ya está en config.toml, el bloque no se vuelve a añadir.
const OLD_HERDR_MARKER = ">>> piSetup >>>";

export async function setup(args: string[]): Promise<void> {
	let withHerdrConfig = false;
	let yes = false;
	let noSuggestions = false;
	for (const a of args) {
		if (a === "--herdr-config") withHerdrConfig = true;
		else if (a === "--yes" || a === "-y") yes = true;
		else if (a === "--no-suggestions") noSuggestions = true;
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
	const result = await runWizard({ interactive, logo: renderSmall(56, "setup"), noSuggestions });
	if (!result) {
		process.exitCode = 1;
		return;
	}
	const { cfg, herdr } = result;
	const agents = cfg.agents;
	if (!isDryRun()) saveConfig(cfg);

	const { ensurePersonal, propagate, PERSONAL_FILE } = await import("./instructions.mts");
	log("Aplicando");
	// Instalación anterior (config de pi enlazada al repo, paquete global): se convierte primero.
	const { migrateLegacy } = await import("./migrate.mts");
	const { legacyInstructions } = migrateLegacy();
	if (agents.includes("pi")) {
		act(`mkdir -p ${join(AGENT_DIR, "extensions")}`, () => mkdirSync(join(AGENT_DIR, "extensions"), { recursive: true }));
		if (!isDryRun()) log(`Bond Extensions de pi: ${await ensureBondLink()} (los repos las cargan con bond init)`);
	}

	// Sugerencias de prompt de pi: config de supi fusionado, enabledModels y el paquete.
	let suggestionsLine = "n/a";
	if (agents.includes("pi")) {
		const { applySuggestions } = await import("./suggestions.mts");
		const s = applySuggestions(cfg);
		for (const n of s.notes) warn(n);
		suggestionsLine = s.enabled ? `${s.model}${s.installed ? "" : " (paquete sin instalar)"}` : "desactivadas";
		if (s.enabled) log(`pi: sugerencias de prompt con ${s.model}`);
	}
	if (herdr) herdrSkill();
	const agy = agents.includes("agy");
	if (agy) agyPlugin();
	globalSkills(agy);
	contextTools();
	if (herdr) herdrIntegrations(agents);
	if (withHerdrConfig && herdr) herdrConfig();
	const { syncAgents } = await import("./models.mts");
	if (!isDryRun() && cfg.providers.length) syncAgents({ agents: agents.filter((a) => ["pi", "opencode", "crush", "codex"].includes(a)) });
	ensurePersonal(legacyInstructions);
	for (const r of propagate(agents)) log(`instrucciones ${r.agent}: ${r.result}${r.why ? ` (${r.why})` : ""}  ${r.file}`);
	if (FROM_SOURCE) linkBond();

	const { CONFIG_FILE } = await import("./config.mts");
	console.log(`
  ${renderSmall(60, "listo")}

  Agentes:        ${agents.join(", ")}  (por defecto: ${cfg.default_agent})
  Endpoints:      ${cfg.providers.map((x) => x.id).join(", ") || "ninguno (cada agente usa su proveedor)"}
  Configuración:  ${CONFIG_FILE}
  Sugerencias:    ${suggestionsLine}  (bond setup --no-suggestions para apagarlas)
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

export const CONTEXT_TOOLS: Array<[string, string]> = [
	["rg", "ripgrep: tool grep de pi"],
	["fd", "tool find de pi"],
	["ast-grep", "skill code-context: bun add -g @ast-grep/cli@0.45.3"],
	["uvx", "uv: servidor MCP duckduckgo"],
	["jq", "repo-map del skill code-context (opcional)"],
];

function contextTools(): void {
	// No se instalan aquí (son paquetes de sistema o globales): se avisa.
	const missing = CONTEXT_TOOLS.filter(([cmd]) => !which(cmd));
	if (missing.length === 0) log(`herramientas de contexto: ${CONTEXT_TOOLS.map(([c]) => c).join(" ")}`);
	for (const [cmd, why] of missing) warn(`falta ${cmd} (${why})`);
}

/** Skills globales (bond-delegate, bond-team): del repo o extraídos del binario. */
export const globalSkillsDir = () => assetsPath("global", "skills");

/**
 * Destinos de los skills globales: ~/.agents/skills (pi, Codex, Copilot, opencode, Crush, Gemini),
 * ~/.claude/skills (Claude Code) y, si agy es uno de tus agentes (su plugin global existe), las
 * skills del plugin.
 */
export function globalSkillTargets(name: string, agy = existsSync(join(agyPluginDir(), "plugin.json"))): string[] {
	return [join(HOME, ".agents", "skills", name), join(HOME, ".claude", "skills", name), ...(agy ? [join(agyPluginDir(), "skills", name)] : [])];
}

/**
 * Manifiesto del plugin global de agy: sin él, agy no carga la carpeta. Su nombre no puede ser
 * «bond», el del plugin del repo: con dos plugins del mismo nombre, agy solo carga el del repo.
 */
export const AGY_PLUGIN_JSON = `${JSON.stringify({ name: "bond-global" }, null, 2)}\n`;

/** Carpeta del skill de Herdr instalado (el compartido o el de pi). */
export function herdrSkillDir(): string | undefined {
	return [SHARED_HERDR_SKILL, PI_HERDR_SKILL].filter((f) => existsSync(f)).map((f) => dirname(f))[0];
}

/**
 * Plugin global de bond para agy: el manifiesto y el skill de Herdr. agy no ve ~/.agents/skills
 * ni tiene un fichero de instrucciones global propio, así que lo de bond va en esta carpeta (las
 * skills de bond las enlaza globalSkills y las reglas, propagate) y nada más de ~/.gemini/config
 * se toca.
 */
export function agyPlugin(): void {
	const manifest = join(agyPluginDir(), "plugin.json");
	if (!existsSync(manifest) || readFileSync(manifest, "utf8") !== AGY_PLUGIN_JSON) {
		act(`escribir ${manifest}`, () => {
			mkdirSync(dirname(manifest), { recursive: true });
			writeFileSync(manifest, AGY_PLUGIN_JSON);
		});
	}
	log(`plugin global de agy: ${agyPluginDir()}`);
	// Enlaza al skill de Herdr que ya hay en la máquina: uno solo que actualizar.
	const herdr = herdrSkillDir();
	if (!herdr) return;
	const dest = join(agyPluginDir(), "skills", "herdr");
	act(`mkdir -p ${dirname(dest)}`, () => mkdirSync(dirname(dest), { recursive: true }));
	(process.platform === "win32" ? copyPath : linkPath)(herdr, dest);
}

export function globalSkills(agy: boolean): void {
	// bond-delegate y bond-team son de Herdr, una herramienta de la máquina: van a nivel de
	// usuario, como el skill herdr, para cualquier agente y en cualquier repo.
	log("Skills globales de bond (multiagente con Herdr)");
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name, agy)) {
			act(`mkdir -p ${dirname(dest)}`, () => mkdirSync(dirname(dest), { recursive: true }));
			// En Windows, copia: los symlinks necesitan permisos especiales.
			(process.platform === "win32" ? copyPath : linkPath)(join(globalSkillsDir(), name), dest);
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
