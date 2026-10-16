// Preguntas de `bond setup`: Herdr, endpoints de modelos y agentes. Devuelve la config global
// lista para guardar; aplicarla (generar la config de cada agente) lo hace setup.mts.
// Sin terminal interactiva o con --yes, usa lo detectado sin preguntar.

import * as p from "@clack/prompts";
import { herdrInstallHelp, installedAgents, AGENTS } from "./catalog-agents.mts";
import { type Config, type Provider, loadConfigOrEmpty, loadState, saveState } from "./config.mts";
import { LOCAL_ENDPOINTS, listModels, probeApis, type EndpointModel } from "./endpoints.mts";
import { saveKey } from "./keys.mts";
import { which } from "./util.mts";

export interface WizardResult {
	cfg: Config;
	herdr: boolean;
}

function cancelled(v: unknown): void {
	if (p.isCancel(v)) {
		p.cancel("setup cancelado: no se ha cambiado nada");
		process.exit(130);
	}
}

const ask = async <T,>(v: Promise<T | symbol>): Promise<T> => {
	const r = await v;
	cancelled(r);
	return r as T;
};

/** Modelos de un endpoint a registrar: todos (local) o los que elija el usuario. */
async function chooseModels(models: EndpointModel[], interactive: boolean, preselectAll: boolean): Promise<EndpointModel[]> {
	if (!interactive || models.length <= 1) return preselectAll || models.length <= 1 ? models : [];
	const ids = await ask(
		p.multiselect({
			message: "¿Qué modelos registrar?",
			options: models.map((m) => ({ value: m.id, label: m.id, hint: m.context ? `ctx ${m.context}` : undefined })),
			initialValues: preselectAll ? models.map((m) => m.id) : [],
			required: false,
		}),
	);
	return models.filter((m) => ids.includes(m.id));
}

async function addProvider(
	cfg: Config,
	entry: { id: string; name: string; kind: string; base_url: string },
	models: EndpointModel[],
	key: string | undefined,
): Promise<void> {
	const s = p.spinner();
	s.start(`${entry.name}: comprobando qué APIs sirve (la primera petición puede cargar el modelo)`);
	const probe = models.length ? await probeApis(entry.base_url, models[0].id, key) : { apis: [], reasoning: false };
	const apis = probe.apis;
	s.stop(`${entry.name}: ${apis.length ? apis.join(", ") : "sin respuesta de chat"}${probe.reasoning ? " · razona" : ""}`);
	const provider: Provider = {
		id: entry.id,
		name: entry.name,
		kind: entry.kind,
		base_url: entry.base_url,
		...(entry.kind !== "openai" ? { free: true } : {}),
		...(key ? { key_stored: true } : {}),
		// El razonamiento se comprueba con el primer modelo; se asume para los demás del endpoint.
		models: models.map((m) => ({ id: m.id, ...(m.context ? { context: m.context } : {}), ...(m.max_output ? { max_output: m.max_output } : {}), ...(probe.reasoning ? { reasoning: true } : {}) })),
	};
	if (key) saveKey(entry.id, key);
	cfg.providers = [...cfg.providers.filter((x) => x.id !== entry.id), provider];
	const state = loadState();
	state.probes[entry.id] = { apis, served: models.map((m) => m.id), at: new Date().toISOString() };
	saveState(state);
}

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24) || "endpoint";

async function endpointsStep(cfg: Config, interactive: boolean): Promise<void> {
	if (cfg.providers.length) {
		p.log.info(`Endpoints configurados: ${cfg.providers.map((x) => `${x.id} (${x.base_url})`).join(", ")}`);
	}
	// Locales: se detectan solos.
	for (const local of LOCAL_ENDPOINTS) {
		if (cfg.providers.some((x) => x.base_url === local.base_url)) continue;
		const models = await listModels(local.base_url, undefined, 2000);
		if (!models) continue;
		const use = interactive ? await ask(p.confirm({ message: `${local.name} detectado en ${local.base_url} (${models.length} modelos). ¿Usarlo?` })) : true;
		if (!use) continue;
		await addProvider(cfg, local, await chooseModels(models, interactive, true), undefined);
	}
	if (!interactive) return;
	for (;;) {
		const choice = await ask(
			p.select({
				message: cfg.providers.length ? "¿Añadir otro endpoint de modelos?" : "¿Añadir un endpoint de modelos? (puedes saltarlo y usar el proveedor propio de cada agente)",
				options: [
					{ value: "done", label: cfg.providers.length ? "No, seguir" : "No, ninguno" },
					{ value: "custom", label: "Compatible con OpenAI (llama-swap, vLLM, Ollama remoto…)" },
					{ value: "openai", label: "OpenAI" },
				],
			}),
		);
		if (choice === "done") return;
		const isOpenAI = choice === "openai";
		const base_url = isOpenAI
			? "https://api.openai.com/v1"
			: await ask(p.text({ message: "URL base (la que acaba en /v1)", placeholder: "http://mi-pasarela:8080/v1", validate: (v) => (/^https?:\/\/\S+$/.test(v ?? "") ? undefined : "tiene que empezar por http:// o https://") }));
		const key = await ask(
			p.password({ message: isOpenAI ? "Clave de la API (se guarda en ~/.bond/keys, permisos 600)" : "Clave, si la pide (vacío si no)", validate: (v) => (isOpenAI && !v ? "OpenAI necesita clave" : undefined) }),
		);
		const s = p.spinner();
		s.start("Leyendo la lista de modelos");
		const models = await listModels(base_url, key || undefined);
		s.stop(models ? `${models.length} modelos` : "no responde");
		if (!models) {
			p.log.error(`${base_url}/models no responde o no es compatible con OpenAI`);
			continue;
		}
		const id = isOpenAI
			? "openai"
			: await ask(p.text({ message: "Nombre corto para este endpoint", initialValue: slug(new URL(base_url).hostname.split(".")[0]), validate: (v) => (/^[a-z0-9][a-z0-9_-]*$/.test(v ?? "") ? undefined : "minúsculas, dígitos, - o _") }));
		const chosen = await chooseModels(models, true, !isOpenAI);
		await addProvider(cfg, { id, name: isOpenAI ? "OpenAI" : id, kind: isOpenAI ? "openai" : "custom", base_url }, chosen, key || undefined);
	}
}

async function agentsStep(cfg: Config, interactive: boolean): Promise<boolean> {
	const installed = installedAgents();
	if (!installed.length) {
		p.note(
			AGENTS.map((a) => `${a.name.padEnd(12)} ${a.install}\n${" ".repeat(13)}${a.url}`).join("\n"),
			"No hay ningún agente instalado: instala al menos uno",
		);
		return false;
	}
	const initial = cfg.agents.length ? cfg.agents.filter((a) => installed.some((i) => i.id === a)) : installed.map((a) => a.id);
	const selected = interactive
		? await ask(
				p.multiselect({
					message: "¿Con qué agentes quieres trabajar?",
					options: installed.map((a) => ({ value: a.id, label: a.name, hint: a.version })),
					initialValues: initial.length ? initial : installed.map((a) => a.id),
					required: true,
				}),
			)
		: initial;
	const missing = AGENTS.filter((a) => !installed.some((i) => i.id === a.id));
	if (interactive && missing.length) p.log.message(`No instalados: ${missing.map((a) => a.name).join(", ")} (bond setup los detectará cuando los instales)`);
	const def =
		selected.length === 1 || !interactive
			? (cfg.default_agent && selected.includes(cfg.default_agent) ? cfg.default_agent : selected[0])
			: await ask(
					p.select({
						message: "¿Agente por defecto? (el que propone bond init y abre bond)",
						options: selected.map((id) => ({ value: id, label: installed.find((a) => a.id === id)?.name ?? id })),
						initialValue: cfg.default_agent && selected.includes(cfg.default_agent) ? cfg.default_agent : selected[0],
					}),
				);
	cfg.agents = selected;
	cfg.default_agent = def;
	return true;
}

export async function runWizard(opts: { interactive: boolean; logo: string }): Promise<WizardResult | undefined> {
	p.intro(opts.logo);
	const cfg = loadConfigOrEmpty();

	// 1. Herdr
	const herdr = !!which("herdr");
	if (herdr) p.log.success("Herdr instalado");
	else {
		p.note(herdrInstallHelp().join("\n"), "Herdr no está instalado (hace falta para abrir el puesto de trabajo con `bond`)");
		if (opts.interactive && !(await ask(p.confirm({ message: "¿Seguir sin Herdr? (lo demás se configura igual)", initialValue: true })))) {
			p.outro("Instala Herdr y vuelve a lanzar bond setup");
			return undefined;
		}
	}

	// 2. Endpoints de modelos
	await endpointsStep(cfg, opts.interactive);

	// 3. Agentes
	if (!(await agentsStep(cfg, opts.interactive))) {
		p.outro("Instala un agente y vuelve a lanzar bond setup");
		return undefined;
	}
	return { cfg, herdr };
}
