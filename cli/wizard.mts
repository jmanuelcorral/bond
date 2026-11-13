// Preguntas de `bond setup`: idioma, Herdr, endpoints de modelos, agentes, sugerencias de
// prompt e iconos del pie de pi.
// Devuelve la config global lista para guardar; aplicarla (generar la config de cada agente)
// lo hace setup.mts.
// Sin terminal interactiva o con --yes, usa lo detectado sin preguntar.

import * as p from "@clack/prompts";
import { type Lang, parseLang } from "../lib/lang.mts";
import { herdrInstallHelp, installedAgents, AGENTS } from "./catalog-agents.mts";
import { type Config, type Provider, configExists, loadConfigOrEmpty, loadState, saveState } from "./config.mts";
import { LOCAL_ENDPOINTS, listModels, probeApis, type EndpointModel } from "./endpoints.mts";
import { detectNerdFonts } from "./fonts.mts";
import { saveKey } from "./keys.mts";
import { lang, setLang, t } from "./messages.mts";
import { pickSuggestionModel } from "./suggestions.mts";
import { run, which } from "./util.mts";

export interface WizardResult {
	cfg: Config;
	herdr: boolean;
}

function cancelled(v: unknown): void {
	if (p.isCancel(v)) {
		p.cancel(t("wizard.cancelled"));
		process.exit(130);
	}
}

const ask = async <T,>(v: Promise<T | symbol>): Promise<T> => {
	const r = await v;
	cancelled(r);
	return r as T;
};

/**
 * Idioma de la consola. Se resuelve y se aplica antes de preguntar nada más, para que el resto
 * del asistente ya salga en el idioma elegido. Con `forced` (bond setup --lang) no se pregunta
 * y se guarda; con BOND_LANG tampoco se pregunta y no se escribe: manda la variable.
 */
export async function langStep(cfg: Config, interactive: boolean, forced?: Lang): Promise<void> {
	if (forced) {
		setLang(forced);
		cfg.ui = { ...cfg.ui, lang: forced };
		p.log.message(t("wizard.lang_set", { lang: forced }));
		return;
	}
	const fromEnv = parseLang(process.env.BOND_LANG);
	if (fromEnv) {
		p.log.message(t("wizard.lang_from_env", { lang: fromEnv }));
		return;
	}
	const initial = cfg.ui?.lang ?? lang();
	const chosen = interactive
		? await ask(
				p.select<Lang>({
					message: t("wizard.lang_question"),
					options: [
						{ value: "es", label: t("wizard.lang_es") },
						{ value: "en", label: t("wizard.lang_en") },
					],
					initialValue: initial,
				}),
			)
		: initial;
	setLang(chosen);
	cfg.ui = { ...cfg.ui, lang: chosen };
}

/** Modelos de un endpoint a registrar: todos (local) o los que elija el usuario. */
async function chooseModels(models: EndpointModel[], interactive: boolean, preselectAll: boolean): Promise<EndpointModel[]> {
	if (!interactive || models.length <= 1) return preselectAll || models.length <= 1 ? models : [];
	const ids = await ask(
		p.multiselect({
			message: t("wizard.models_which"),
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
	s.start(t("wizard.probing", { name: entry.name }));
	const probe = models.length ? await probeApis(entry.base_url, models[0].id, key) : { apis: [], reasoning: false };
	const apis = probe.apis;
	s.stop(t("wizard.probed", { name: entry.name, apis: apis.length ? apis.join(", ") : t("wizard.probed_none"), reasoning: probe.reasoning ? t("wizard.reasoning") : "" }));
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
		p.log.info(t("wizard.endpoints_configured", { list: cfg.providers.map((x) => `${x.id} (${x.base_url})`).join(", ") }));
	}
	// Locales: se detectan solos.
	for (const local of LOCAL_ENDPOINTS) {
		if (cfg.providers.some((x) => x.base_url === local.base_url)) continue;
		const models = await listModels(local.base_url, undefined, 2000);
		if (!models) continue;
		const use = interactive ? await ask(p.confirm({ message: t("wizard.local_use", { name: local.name, url: local.base_url, count: models.length }) })) : true;
		if (!use) continue;
		await addProvider(cfg, local, await chooseModels(models, interactive, true), undefined);
	}
	if (!interactive) return;
	for (;;) {
		const choice = await ask(
			p.select({
				message: cfg.providers.length ? t("wizard.add_another") : t("wizard.add_first"),
				options: [
					{ value: "done", label: cfg.providers.length ? t("wizard.no_continue") : t("wizard.no_none") },
					{ value: "custom", label: t("wizard.opt_custom") },
					{ value: "openai", label: t("wizard.opt_openai") },
				],
			}),
		);
		if (choice === "done") return;
		const isOpenAI = choice === "openai";
		const base_url = isOpenAI
			? "https://api.openai.com/v1"
			: await ask(p.text({ message: t("wizard.base_url"), placeholder: t("wizard.base_url_placeholder"), validate: (v) => (/^https?:\/\/\S+$/.test(v ?? "") ? undefined : t("wizard.base_url_invalid")) }));
		const key = await ask(
			p.password({ message: isOpenAI ? t("wizard.key_openai") : t("wizard.key_optional"), validate: (v) => (isOpenAI && !v ? t("wizard.key_required") : undefined) }),
		);
		const s = p.spinner();
		s.start(t("wizard.reading_models"));
		const models = await listModels(base_url, key || undefined);
		s.stop(models ? t("wizard.models_count", { count: models.length }) : t("wizard.no_answer"));
		if (!models) {
			p.log.error(t("wizard.endpoint_dead", { url: `${base_url}/models` }));
			continue;
		}
		const id = isOpenAI
			? "openai"
			: await ask(p.text({ message: t("wizard.endpoint_name"), initialValue: slug(new URL(base_url).hostname.split(".")[0]), validate: (v) => (/^[a-z0-9][a-z0-9_-]*$/.test(v ?? "") ? undefined : t("wizard.endpoint_name_invalid")) }));
		const chosen = await chooseModels(models, true, !isOpenAI);
		await addProvider(cfg, { id, name: isOpenAI ? "OpenAI" : id, kind: isOpenAI ? "openai" : "custom", base_url }, chosen, key || undefined);
	}
}

async function agentsStep(cfg: Config, interactive: boolean): Promise<boolean> {
	const installed = installedAgents();
	if (!installed.length) {
		p.note(
			AGENTS.map((a) => `${a.name.padEnd(12)} ${a.install}\n${" ".repeat(13)}${a.url}`).join("\n"),
			t("wizard.no_agents_note"),
		);
		return false;
	}
	const initial = cfg.agents.length ? cfg.agents.filter((a) => installed.some((i) => i.id === a)) : installed.map((a) => a.id);
	const selected = interactive
		? await ask(
				p.multiselect({
					message: t("wizard.agents_which"),
					options: installed.map((a) => ({ value: a.id, label: a.name, hint: a.version })),
					initialValues: initial.length ? initial : installed.map((a) => a.id),
					required: true,
				}),
			)
		: initial;
	const missing = AGENTS.filter((a) => !installed.some((i) => i.id === a.id));
	if (interactive && missing.length) p.log.message(t("wizard.agents_missing", { list: missing.map((a) => a.name).join(", ") }));
	const def =
		selected.length === 1 || !interactive
			? (cfg.default_agent && selected.includes(cfg.default_agent) ? cfg.default_agent : selected[0])
			: await ask(
					p.select({
						message: t("wizard.agent_default"),
						options: selected.map((id) => ({ value: id, label: installed.find((a) => a.id === id)?.name ?? id })),
						initialValue: cfg.default_agent && selected.includes(cfg.default_agent) ? cfg.default_agent : selected[0],
					}),
				);
	cfg.agents = selected;
	cfg.default_agent = def;
	return true;
}

/**
 * Sugerencias de prompt de pi (ghost text after-turn). Se proponen activas si el registro de
 * bond tiene un modelo barato; sin agentes pi no se toca nada.
 */
async function suggestionsStep(cfg: Config, interactive: boolean, forcedOff: boolean): Promise<void> {
	if (!cfg.agents.includes("pi")) return;
	if (forcedOff) {
		cfg.suggestions = { enabled: false };
		p.log.message(t("wizard.suggestions_off_flag"));
		return;
	}
	const proposed = cfg.suggestions?.model ?? pickSuggestionModel(cfg);
	if (!proposed) {
		cfg.suggestions = { ...(cfg.suggestions ?? {}), enabled: false };
		p.log.warn(t("wizard.suggestions_no_models"));
		return;
	}
	const initial = cfg.suggestions?.enabled ?? true;
	const enabled = interactive
		? await ask(p.confirm({ message: t("wizard.suggestions_ask"), initialValue: initial }))
		: initial;
	cfg.suggestions = { enabled, model: proposed };
	p.log.message(t("wizard.suggestions_state", { state: enabled ? t("wizard.on") : t("wizard.off"), model: proposed }));
}

/** Lista corta de fuentes para un mensaje: las tres primeras y cuántas más hay. */
const fontList = (fonts: string[]) => fonts.slice(0, 3).join(", ") + (fonts.length > 3 ? t("wizard.fonts_more", { count: fonts.length - 3 }) : "");

/**
 * Iconos del pie de estado de pi. Con una Nerd Font instalada se pregunta si usar sus iconos
 * (instalada no quiere decir que la terminal la use); sin ella, o si no, emojis. Un
 * `[ui] icons = "unicode"` puesto a mano se respeta.
 */
export async function iconsStep(cfg: Config, interactive: boolean, detect: () => string[] = detectNerdFonts): Promise<void> {
	if (!cfg.agents.includes("pi")) return;
	if (cfg.ui?.icons === "unicode") {
		p.log.message(t("wizard.icons_unicode"));
		return;
	}
	const fonts = detect();
	if (!fonts.length) {
		cfg.ui = { ...cfg.ui, icons: "emoji" };
		p.log.message(t("wizard.icons_no_nerd"));
		return;
	}
	const initial = cfg.ui?.icons ? cfg.ui.icons === "nerd" : true;
	const nerd = interactive
		? await ask(
				p.confirm({
					message: t("wizard.icons_ask", { fonts: fontList(fonts) }),
					initialValue: initial,
				}),
			)
		: initial;
	cfg.ui = { ...cfg.ui, icons: nerd ? "nerd" : "emoji" };
	p.log.message(t("wizard.icons_state", { label: nerd ? t("setup.icon.nerd") : t("setup.icon.emoji") }));
}

/**
 * Subcomando por defecto al ejecutar bond sin subcomando (D21) e instalación de bond-app.
 * - Instalaciones nuevas: "app" por defecto.
 * - Instalaciones existentes: conserva "dev" (o lo que esté configurado) si se usa --yes.
 */
export async function defaultCommandStep(cfg: Config, interactive: boolean, isNew: boolean): Promise<void> {
	const initial = cfg.default_command ?? (isNew ? "app" : "dev");
	if (interactive) {
		const chosen = await ask(
			p.select<"app" | "dev">({
				message: t("wizard.default_command_question"),
				options: [
					{ value: "app", label: t("wizard.default_command_app"), hint: t("wizard.default_command_app_hint") },
					{ value: "dev", label: t("wizard.default_command_dev"), hint: t("wizard.default_command_dev_hint") },
				],
				initialValue: initial,
			}),
		);
		cfg.default_command = chosen;
		p.log.message(t("wizard.default_command_state", { cmd: chosen }));

		const hasBondApp = !!which("bond-app");
		if (hasBondApp) {
			p.log.success(t("wizard.bond_app_installed"));
		} else {
			const wantInstall = await ask(
				p.confirm({
					message: t("wizard.bond_app_install_ask"),
					initialValue: true,
				}),
			);
			if (wantInstall) {
				const s = p.spinner();
				s.start("npm install -g bond-app");
				const res = run("npm", ["install", "-g", "bond-app"]);
				if (res.status === 0) {
					s.stop(t("wizard.bond_app_install_success"));
				} else {
					s.stop(t("wizard.bond_app_install_failed", { err: res.stderr.trim() || res.stdout.trim() }));
					p.note(t("wizard.bond_app_not_installed"), t("wizard.bond_app_missing"));
				}
			} else {
				p.note(t("wizard.bond_app_not_installed"), t("wizard.bond_app_missing"));
			}
		}
	} else {
		// Modo no interactivo / --yes:
		// "3. bond setup pregunta por el comportamiento por defecto y lo guarda; --yes usa app en instalaciones nuevas y no cambia una configuración existente."
		if (isNew) {
			cfg.default_command = "app";
		}
		const hasBondApp = !!which("bond-app");
		if (!hasBondApp) {
			p.log.message(t("wizard.bond_app_not_installed"));
		}
	}
}

export async function runWizard(opts: { interactive: boolean; logo: string; noSuggestions?: boolean; lang?: Lang; isNew?: boolean }): Promise<WizardResult | undefined> {
	p.intro(opts.logo);
	const isNew = opts.isNew ?? !configExists();
	const cfg = loadConfigOrEmpty();

	// 1. Idioma de la consola: se resuelve primero para preguntar lo demás ya en ese idioma.
	await langStep(cfg, opts.interactive, opts.lang);

	// 2. Herdr
	const herdr = !!which("herdr");
	if (herdr) p.log.success(t("wizard.herdr_installed"));
	else {
		p.note([...herdrInstallHelp(), t("wizard.herdr_more")].join("\n"), t("wizard.herdr_missing"));
		if (opts.interactive && !(await ask(p.confirm({ message: t("wizard.herdr_continue"), initialValue: true })))) {
			p.outro(t("wizard.herdr_install_first"));
			return undefined;
		}
	}

	// 3. Endpoints de modelos
	await endpointsStep(cfg, opts.interactive);

	// 4. Agentes
	if (!(await agentsStep(cfg, opts.interactive))) {
		p.outro(t("wizard.agent_install_first"));
		return undefined;
	}

	// 5. Sugerencias de prompt (solo pi)
	await suggestionsStep(cfg, opts.interactive, opts.noSuggestions === true);

	// 6. Iconos del pie de pi (Nerd Font o emojis)
	await iconsStep(cfg, opts.interactive);

	// 7. Subcomando por defecto y bond-app
	await defaultCommandStep(cfg, opts.interactive, isNew);

	return { cfg, herdr };
}
