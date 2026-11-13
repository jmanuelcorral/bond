// `bond setup`: deja la máquina lista: Herdr, endpoints de modelos, agentes elegidos, skills
// globales e instrucciones personales en cada agente. Idempotente: se puede repetir.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderSmall } from "../lib/bond-logo.mts";
import { parseLang, type Lang } from "../lib/lang.mts";
import type { IconStyle } from "../lib/status-bar.mts";
import { agentInstalled, agyPluginDir } from "./catalog-agents.mts";
import type { PropagateResult } from "./instructions.mts";
import { type MessageKey, setLang, t } from "./messages.mts";
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

export const setupHelp = (): string => t("setup.help");

const HERDR_MARKER = ">>> bond >>>";
// Marca de antes del renombrado: si ya está en config.toml, el bloque no se vuelve a añadir.
const OLD_HERDR_MARKER = ">>> piSetup >>>";

export async function setup(args: string[]): Promise<void> {
	let withHerdrConfig = false;
	let yes = false;
	let noSuggestions = false;
	// El idioma elegido por flag manda desde antes de la primera línea impresa (también en la ayuda).
	const langArg = langFlag(args);
	if (langArg) setLang(langArg);
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--herdr-config") withHerdrConfig = true;
		else if (a === "--yes" || a === "-y") yes = true;
		else if (a === "--no-suggestions") noSuggestions = true;
		else if (a === "--dry-run" || a === "--no-pi") continue; // --dry-run lo trata main; --no-pi ya no hace falta
		else if (a === "--lang") i++; // su valor lo interpreta langFlag(), que ya lo validó
		else if (a.startsWith("--lang=")) continue;
		else die(t("setup.unknown_opt", { opt: a }));
	}
	// Desde el repo, las dependencias (prompts, TOML) se instalan antes de cargar el asistente.
	if (FROM_SOURCE) installDeps();
	const { runWizard } = await import("./wizard.mts");
	const { saveConfig, configExists } = await import("./config.mts");
	const { init: importLegacyModels } = await import("./models.mts");
	const isNew = !configExists();
	// Instalación anterior desde el repo: sus modelos de pi pasan al registro global.
	if (FROM_SOURCE && isNew) importLegacyModels();

	const interactive = !yes && process.stdin.isTTY === true;
	const result = await runWizard({ interactive, logo: renderSmall(56, "setup"), noSuggestions, lang: langArg, isNew });
	if (!result) {
		process.exitCode = 1;
		return;
	}
	const { cfg, herdr } = result;
	const agents = cfg.agents;
	if (!isDryRun()) saveConfig(cfg);

	const { ensurePersonal, propagate, PERSONAL_FILE } = await import("./instructions.mts");
	log(t("setup.applying"));
	// Instalación anterior (config de pi enlazada al repo, paquete global): se convierte primero.
	const { migrateLegacy } = await import("./migrate.mts");
	const { legacyInstructions } = migrateLegacy();
	if (agents.includes("pi")) {
		act(`mkdir -p ${join(AGENT_DIR, "extensions")}`, () => mkdirSync(join(AGENT_DIR, "extensions"), { recursive: true }));
		if (!isDryRun()) log(t("setup.pi_extensions", { path: await ensureBondLink() }));
	}

	// Sugerencias de prompt de pi: config de supi fusionado, enabledModels y el paquete.
	let suggestionsLine = "n/a";
	if (agents.includes("pi")) {
		const { applySuggestions } = await import("./suggestions.mts");
		const s = applySuggestions(cfg);
		for (const n of s.notes) warn(n);
		suggestionsLine = s.enabled ? `${s.model}${s.installed ? "" : t("setup.suggestions_pkg_missing")}` : t("setup.suggestions_off");
		if (s.enabled) log(t("setup.suggestions_on", { model: s.model ?? "" }));
	}
	if (herdr) herdrSkill();
	const agy = agents.includes("agy");
	if (agy) agyPlugin();
	globalSkills(agy);
	contextTools();
	if (herdr) herdrIntegrations(agents);
	if (withHerdrConfig && herdr) herdrConfig();
	const { syncAgents } = await import("./models.mts");
	if (!isDryRun() && cfg.providers.length) syncAgents({ agents: agents.filter((a) => ["pi", "opencode", "crush"].includes(a)) });
	ensurePersonal(legacyInstructions);
	for (const r of propagate(agents)) log(t("setup.instructions", { agent: r.agent, result: t(INSTR_RESULT[r.result]), why: r.why ? ` (${t(INSTR_WHY[r.why])})` : "" }) + `  ${r.file}`);
	if (FROM_SOURCE) linkBond();

	const { CONFIG_FILE } = await import("./config.mts");
	console.log(
		t("setup.summary", {
			logo: renderSmall(60, t("setup.ready_short")),
			agents: agents.join(", "),
			default: cfg.default_agent ?? "-",
			endpoints: cfg.providers.map((x) => x.id).join(", ") || t("setup.endpoints_none"),
			config: CONFIG_FILE,
			suggestions: suggestionsLine,
			icons: agents.includes("pi") ? t("setup.icons_line", { icons: t(ICON_LABEL[cfg.ui?.icons ?? "emoji"]) }) : "",
			personal: PERSONAL_FILE,
		}),
	);
}

/**
 * `--lang es|en` (o `--lang=es`) de la línea de opciones. Muere si el valor no es un idioma
 * que bond soporte. Se usa también desde main para que el flag afecte a `bond setup --help`.
 */
export function langFlag(args: string[]): Lang | undefined {
	if (!args.some((a) => a === "--lang" || a.startsWith("--lang="))) return undefined;
	const i = args.indexOf("--lang");
	const raw = i >= 0 ? args[i + 1] : args.find((a) => a.startsWith("--lang="))?.slice(7);
	const lang = parseLang(raw);
	if (!lang) die(t("setup.unknown_opt", { opt: `--lang ${raw ?? ""}`.trim() }));
	return lang;
}

/** Dependencias de la CLI (smol-toml): node_modules del repo, desde package-lock.json. */
function installDeps(): void {
	if (existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) return;
	log(t("setup.installing_deps"));
	if (which("npm")) runAct("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: REPO_DIR });
	else if (which("bun")) runAct("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: REPO_DIR });
	else die(t("setup.need_npm_or_bun"));
}

/**
 * Etiquetas de los estados de propagate() y de por qué se omite un fichero: códigos internos
 * traducidos al imprimirlos, para no tocar las reglas que bond escribe en el agente.
 */
const INSTR_RESULT: Record<PropagateResult, MessageKey> = {
	updated: "setup.instr.updated",
	current: "setup.instr.current",
	skipped: "setup.instr.skipped",
};
const INSTR_WHY: Record<"symlink", MessageKey> = { symlink: "setup.instr.symlink" };

/** Cómo se dice cada estilo de iconos en el resumen de setup. */
const ICON_LABEL: Record<IconStyle, MessageKey> = {
	nerd: "setup.icon.nerd",
	emoji: "setup.icon.emoji",
	unicode: "setup.icon.unicode",
};

export const SHARED_HERDR_SKILL = join(HOME, ".agents", "skills", "herdr", "SKILL.md");
export const PI_HERDR_SKILL = join(AGENT_DIR, "skills", "herdr", "SKILL.md");

function herdrSkill(): void {
	// pi lee skills de ~/.pi/agent/skills y de ~/.agents/skills: con el mismo nombre en las
	// dos hay colisión, así que solo debe existir uno.
	const fresh = run("herdr", ["--skill"]).stdout.trimEnd();
	if (existsSync(SHARED_HERDR_SKILL)) {
		const shared = readFileSync(SHARED_HERDR_SKILL, "utf8").trimEnd();
		log(t("setup.herdr_shared", { path: SHARED_HERDR_SKILL }));
		if (shared !== fresh) {
			warn(t("setup.herdr_mismatch"));
			warn(t("setup.herdr_update", { path: SHARED_HERDR_SKILL }));
		}
		if (existsSync(PI_HERDR_SKILL)) {
			const mine = readFileSync(PI_HERDR_SKILL, "utf8").trimEnd();
			// Solo se borra si es la copia que generaba el instalador; si la editaste, se avisa.
			if (mine === fresh || mine === shared) {
				log(t("setup.herdr_removing_dup", { dir: dirname(PI_HERDR_SKILL) }));
				act(`rm -r ${dirname(PI_HERDR_SKILL)}`, () => rmSync(dirname(PI_HERDR_SKILL), { recursive: true }));
			} else warn(t("setup.herdr_local_changes", { file: PI_HERDR_SKILL }));
		}
	} else {
		log(t("setup.herdr_installing"));
		act(`herdr --skill > ${PI_HERDR_SKILL}`, () => {
			mkdirSync(dirname(PI_HERDR_SKILL), { recursive: true });
			writeFileSync(PI_HERDR_SKILL, `${fresh}\n`);
		});
	}
}

export const CONTEXT_TOOLS: Array<[string, MessageKey]> = [
	["rg", "setup.tool.rg"],
	["fd", "setup.tool.fd"],
	["ast-grep", "setup.tool.ast-grep"],
	["uvx", "setup.tool.uvx"],
	["jq", "setup.tool.jq"],
];

function contextTools(): void {
	// No se instalan aquí (son paquetes de sistema o globales): se avisa.
	const missing = CONTEXT_TOOLS.filter(([cmd]) => !which(cmd));
	if (missing.length === 0) log(t("setup.context_tools", { list: CONTEXT_TOOLS.map(([c]) => c).join(" ") }));
	for (const [cmd, why] of missing) warn(t("setup.context_tool_missing", { cmd, why: t(why) }));
}

/** Skills globales (bond-delegate, bond-team): del repo o extraídos del binario. */
export const globalSkillsDir = () => assetsPath("global", "skills");

/**
 * Destinos de los skills globales: ~/.agents/skills (pi, Codex, Copilot, opencode y Crush),
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
		act(t("util.write", { file: manifest }), () => {
			mkdirSync(dirname(manifest), { recursive: true });
			writeFileSync(manifest, AGY_PLUGIN_JSON);
		});
	}
	log(t("setup.agy_plugin", { dir: agyPluginDir() }));
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
	log(t("setup.global_skills"));
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name, agy)) {
			act(`mkdir -p ${dirname(dest)}`, () => mkdirSync(dirname(dest), { recursive: true }));
			// En Windows, copia: los symlinks necesitan permisos especiales.
			(process.platform === "win32" ? copyPath : linkPath)(join(globalSkillsDir(), name), dest);
		}
	}
}

/** Integraciones de Herdr que no se llaman como el agente de bond. */
const INTEGRATION_AGENT: Record<string, string> = { "antigravity-cli": "agy" };

export interface HerdrIntegration {
	/** Nombre de la integración en Herdr (antigravity-cli). */
	integration: string;
	/** Agente de bond al que sirve (agy). */
	agent: string;
	state: string;
}

/** Integraciones de Herdr: estado por agente según `herdr integration status`. */
export function parseIntegrationStatus(text: string): HerdrIntegration[] {
	return [...text.matchAll(/^([a-z0-9_-]+): (.+?)(?: \(|$)/gm)].map((m) => ({ integration: m[1], agent: INTEGRATION_AGENT[m[1]] ?? m[1], state: m[2] }));
}

export const herdrIntegrationStatus = () => parseIntegrationStatus(run("herdr", ["integration", "status"]).stdout);

/** Las integraciones de tus agentes instalados (todas las de los instalados si aún no los elegiste). */
export const integrationsFor = (all: HerdrIntegration[], agents: string[], installed: (agent: string) => boolean = agentInstalled) =>
	all.filter((s) => installed(s.agent) && (!agents.length || agents.includes(s.agent)));

export function herdrIntegrations(agents: string[]): void {
	// Con la integración, cada agente le cuenta a Herdr su estado real (working, blocked, done)
	// en vez de que Herdr lo adivine mirando la pantalla; la de agy le da su sesión, de la que
	// bond team collect saca el informe. Solo para los agentes instalados.
	log(t("setup.integrations"));
	for (const { integration, agent, state } of integrationsFor(herdrIntegrationStatus(), agents)) {
		if (!agents.includes(agent)) continue;
		if (state.startsWith("current")) {
			log(t("setup.integration_current", { name: integration }));
			continue;
		}
		// Herdr se niega si el agente aún no creó su carpeta de config (nunca se ha abierto):
		// es un aviso, no un error; se instala en el siguiente bond setup.
		act(`herdr integration install ${integration}`, () => {
			const r = run("herdr", ["integration", "install", integration]);
			if (r.status === 0) log(t("setup.integration_installed", { name: integration }));
			else warn(t("setup.integration_failed", { name: integration, err: (r.stderr || r.stdout).trim().split("\n").pop() ?? "", agent }));
		});
	}
}

function herdrConfig(): void {
	const file = join(process.env.XDG_CONFIG_HOME || join(HOME, ".config"), "herdr", "config.toml");
	if (existsSync(file) && [HERDR_MARKER, OLD_HERDR_MARKER].some((m) => readFileSync(file, "utf8").includes(m))) {
		warn(t("setup.herdr_config_has", { file }));
		warn(t("setup.herdr_config_edit"));
		return;
	}
	log(t("setup.herdr_config_adding", { file }));
	act(`cat herdr/config.snippet.toml >> ${file}`, () => {
		mkdirSync(dirname(file), { recursive: true });
		const snippet = readFileSync(assetsPath("herdr", "config.snippet.toml"), "utf8");
		appendFileSync(file, `\n${HERDR_MARKER}\n${snippet}# <<< bond <<<\n`);
		if (run("herdr", ["server", "reload-config"]).status !== 0) {
			warn(t("setup.herdr_config_reload"));
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
		log(t("setup.on_path", { path: current }));
		return;
	}
	if (current) {
		warn(t("setup.other_bond", { current, src }));
		return;
	}
	const dir = bondLinkDirs()[0];
	if (!dir) {
		warn(t("setup.no_bin_dir", { dir: join(REPO_DIR, "bin") }));
		return;
	}
	const dest = join(dir, "bond");
	if (exists(dest) && !brokenLink(dest)) {
		warn(t("setup.dest_exists", { dest }));
		return;
	}
	// Un enlace roto (p. ej. tras mover el repo) se sustituye.
	if (brokenLink(dest)) act(`rm ${dest}`, () => rmSync(dest));
	act(`ln -s ${src} ${dest}`, () => symlinkSync(src, dest));
	log(t("setup.linked", { dest, src }));
}
