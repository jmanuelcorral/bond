// `bond run <agente>`: lanza un agente con el entorno que necesita para usar los modelos del
// registro global. Hoy solo Copilot CLI, que configura su proveedor propio con variables.

import { spawnSync } from "node:child_process";
import { activeProviders, loadConfig, loadState, providerApis } from "./config.mts";
import { readKey } from "./keys.mts";
import { die, which } from "./util.mts";

export const RUN_HELP = `Uso: bond run copilot [--model <proveedor>/<modelo>] [argumentos de copilot...]

Lanza Copilot CLI contra un modelo del registro global (modo BYOK de Copilot), poniendo
COPILOT_PROVIDER_BASE_URL, COPILOT_MODEL, límites de tokens y la API (completions o
responses). Sin --model, usa el primer modelo activo. No hace falta cuenta de GitHub.

Ejemplos:
  bond run copilot
  bond run copilot --model halo/flash-halogen -p "explica este repo"`;

export function runAgent(args: string[]): void {
	const [agent, ...rest] = args;
	if (!agent) {
		console.log(RUN_HELP);
		process.exit(2);
	}
	if (agent !== "copilot") die(`bond run solo admite copilot por ahora (pidió: ${agent})`, 2);
	if (!which("copilot")) die("copilot no está en el PATH");

	let wanted: string | undefined;
	const pass: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		if (rest[i] === "--model") wanted = rest[++i] ?? die("--model necesita proveedor/modelo");
		else pass.push(rest[i]);
	}

	const state = loadState();
	const providers = activeProviders(loadConfig()).filter((p) => {
		const apis = providerApis(p, state);
		return apis.includes("chat") || apis.includes("responses");
	});
	const pairs = providers.flatMap((p) => p.models.filter((m) => !m.agents || m.agents.includes("copilot")).map((m) => ({ p, m })));
	const pick = wanted ? pairs.find(({ p, m }) => `${p.id}/${m.id}` === wanted) : pairs[0];
	if (!pick) die(wanted ? `no hay modelo ${wanted} usable por Copilot (bond models list)` : "no hay modelos usables por Copilot (bond models list)");

	const { p, m } = pick;
	const apis = providerApis(p, state);
	const env: Record<string, string> = {
		...process.env,
		COPILOT_PROVIDER_BASE_URL: p.base_url,
		COPILOT_PROVIDER_TYPE: "openai",
		COPILOT_PROVIDER_WIRE_API: apis.includes("chat") ? "completions" : "responses",
		COPILOT_MODEL: m.id,
	} as Record<string, string>;
	if (m.context) env.COPILOT_PROVIDER_MAX_PROMPT_TOKENS = String(m.context - (m.max_output ?? 0));
	if (m.max_output) env.COPILOT_PROVIDER_MAX_OUTPUT_TOKENS = String(m.max_output);
	const key = p.key_stored ? readKey(p.id) : p.api_key_env ? process.env[p.api_key_env] : undefined;
	if (key) env.COPILOT_PROVIDER_API_KEY = key;

	const r = spawnSync("copilot", pass, { stdio: "inherit", env });
	process.exitCode = r.status ?? 1;
}
