// `bond run <agente>`: lanza un agente con el entorno que necesita para usar los modelos del
// registro global. Hoy solo Copilot CLI, que configura su proveedor propio con variables.

import { spawnSync } from "node:child_process";
import { activeProviders, loadConfig, loadState, providerApis } from "./config.mts";
import { readKey } from "./keys.mts";
import { t } from "./messages.mts";
import { die, which } from "./util.mts";

export const runHelp = (): string => t("run.help");
export const RUN_HELP = Object.assign(() => runHelp(), { toString: () => runHelp(), [Symbol.toPrimitive]: () => runHelp(), [Symbol.for("nodejs.util.inspect.custom")]: () => runHelp() });

export function runAgent(args: string[]): void {
	const [agent, ...rest] = args;
	if (!agent) {
		console.log(runHelp());
		process.exit(2);
	}
	if (agent !== "copilot") die(t("run.only_copilot", { agent }), 2);
	if (!which("copilot")) die(t("run.not_in_path"));

	let wanted: string | undefined;
	const pass: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		if (rest[i] === "--model") wanted = rest[++i] ?? die(t("run.model_needs_arg"));
		else pass.push(rest[i]);
	}

	const state = loadState();
	const providers = activeProviders(loadConfig()).filter((p) => {
		const apis = providerApis(p, state);
		return apis.includes("chat") || apis.includes("responses");
	});
	const pairs = providers.flatMap((p) => p.models.filter((m) => !m.agents || m.agents.includes("copilot")).map((m) => ({ p, m })));
	const pick = wanted ? pairs.find(({ p, m }) => `${p.id}/${m.id}` === wanted) : pairs[0];
	if (!pick) {
		if (!wanted) die(t("run.no_models"));
		// Sin match, enseña la forma correcta con un ejemplo real del registro (#78):
		// el error seco no aclaraba que faltaba el prefijo del proveedor.
		const ex = pairs[0];
		die(ex ? t("run.no_model_named_hint", { model: wanted, example: `${ex.p.id}/${ex.m.id}` }) : t("run.no_model_named", { model: wanted }));
	}

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
