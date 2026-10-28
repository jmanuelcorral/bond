// Agentes que bond conoce: ejecutable, cómo instalarlo y dónde están sus instrucciones globales.

import { join } from "node:path";
import { run, HOME, which } from "./util.mts";

export interface AgentInfo {
	id: string;
	name: string;
	/** Ejecutable (es también el kind de Herdr). */
	bin: string;
	install: string;
	url: string;
	/** Fichero de instrucciones globales del agente (sin él, bond setup no las propaga). */
	instructions?: () => string;
}

const xdg = () => process.env.XDG_CONFIG_HOME || join(HOME, ".config");

/** Plugin global de bond para agy: sus reglas (rules/AGENTS.md) y las skills globales. */
export const agyPluginDir = () => join(HOME, ".gemini", "config", "plugins", "bond");

/** Donde deja agy su instalador, que no siempre está en el PATH de las shells no interactivas. */
export const agyLocalBin = () => join(HOME, ".local", "bin", process.platform === "win32" ? "agy.exe" : "agy");

export const AGENTS: AgentInfo[] = [
	{ id: "pi", name: "pi", bin: "pi", install: "npm i -g @earendil-works/pi-coding-agent", url: "https://pi.dev", instructions: () => join(process.env.PI_CODING_AGENT_DIR || join(HOME, ".pi", "agent"), "AGENTS.md") },
	{ id: "claude", name: "Claude Code", bin: "claude", install: "curl -fsSL https://claude.ai/install.sh | bash", url: "https://code.claude.com/docs", instructions: () => join(HOME, ".claude", "CLAUDE.md") },
	{ id: "codex", name: "Codex", bin: "codex", install: "npm i -g @openai/codex", url: "https://github.com/openai/codex", instructions: () => join(process.env.CODEX_HOME || join(HOME, ".codex"), "AGENTS.md") },
	{ id: "copilot", name: "Copilot CLI", bin: "copilot", install: "npm i -g @github/copilot", url: "https://github.com/github/copilot-cli", instructions: () => join(process.env.COPILOT_HOME || join(HOME, ".copilot"), "copilot-instructions.md") },
	{ id: "opencode", name: "opencode", bin: "opencode", install: "curl -fsSL https://opencode.ai/install | bash", url: "https://opencode.ai", instructions: () => join(xdg(), "opencode", "AGENTS.md") },
	{ id: "crush", name: "Crush", bin: "crush", install: "brew install charmbracelet/tap/crush", url: "https://github.com/charmbracelet/crush", instructions: () => join(xdg(), "crush", "CRUSH.md") },
	{ id: "gemini", name: "Gemini CLI", bin: "gemini", install: "npm i -g @google/gemini-cli", url: "https://github.com/google-gemini/gemini-cli", instructions: () => join(HOME, ".gemini", "GEMINI.md") },
	{ id: "agy", name: "Antigravity", bin: "agy", install: "curl -fsSL https://antigravity.google/cli/install.sh | bash", url: "https://antigravity.google", instructions: () => join(agyPluginDir(), "rules", "AGENTS.md") },
];

export const agentInfo = (id: string) => AGENTS.find((a) => a.id === id);

/** Agentes instalados, con su versión (la primera línea de `--version`). */
export function installedAgents(): Array<AgentInfo & { version: string }> {
	return AGENTS.filter((a) => which(a.bin)).map((a) => ({
		...a,
		version: /\d+\.\d+(?:\.\d+)?/.exec(run(a.bin, ["--version"], { timeout: 15_000 }).stdout)?.[0] ?? "?",
	}));
}

/** Cómo instalar Herdr según el sistema. */
export function herdrInstallHelp(): string[] {
	const win = process.platform === "win32";
	return [
		win ? `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"` : "curl -fsSL https://herdr.dev/install.sh | sh",
		...(win ? [] : ["brew install herdr"]),
		"Más opciones: https://herdr.dev/docs/install/",
	];
}
