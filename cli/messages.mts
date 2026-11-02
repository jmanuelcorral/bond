/**
 * Textos de la consola de bond en los dos idiomas que soporta. Las claves se tipan contra `es`:
 * una clave sin su traducción en `en` no pasa `npm run typecheck`, así que el typecheck actúa
 * de inventario de traducciones pendientes.
 *
 * Aquí va solo lo que bond imprime por consola. Los textos que reciben los agentes (las reglas
 * de cli/instructions.mts, la plantilla de ~/.bond/AGENTS.md) no están: siguen en español.
 */

import { type Lang, resolveLang } from "../lib/lang.mts";

const es = {
	// ---- bond setup: ayuda y opciones ----
	"setup.help": `Uso: bond setup [opciones]

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
  --lang <es|en>   Idioma de la consola sin preguntar
  --no-suggestions No activar las sugerencias de prompt de pi
  --herdr-config   Añade el snippet de Herdr a ~/.config/herdr/config.toml
  --dry-run        Pregunta, pero solo enseña lo que haría al aplicar
  -h, --help       Esta ayuda`,
	"setup.unknown_opt": "opción desconocida: {opt} (bond setup --help)",
	"config.migrated": "configuración global movida de {from} a {to} (la antigua se queda como copia)",
	// ---- mensajes comunes (cli/util.mts) y de las sugerencias de prompt de pi ----
	"util.warn": "aviso:",
	"util.failed": "falló: {cmd}",
	"util.write": "escribir {file}",
	"util.bond_block": "bloque de bond en {file}",
	"util.already_linked": "ya enlazado: {path}",
	"util.linked": "enlazado: {dest} -> {src}",
	"util.exists_backed_up": "{dest} ya existe; lo guardo como {bak}",
	"suggestions.enabled_models": "enabledModels de pi: {state}",
	"suggestions.em_not_set": '["*"] (no estaba puesto)',
	"suggestions.em_already": "ya estaba puesto, se respeta",
	"suggestions.note_em_already": "enabledModels de pi ya estaba puesto",
	"suggestions.note_declared": "{name} ya estaba declarado en la config de pi",
	"setup.installing_deps": "Instalando las dependencias de bond (npm ci, sin scripts)",
	"setup.need_npm_or_bun": "hace falta npm o bun para instalar las dependencias de bond",
	"setup.applying": "Aplicando",
	"setup.ready_short": "listo",
	"setup.pi_extensions": "Bond Extensions de pi: {path} (los repos las cargan con bond init)",
	"setup.suggestions_on": "pi: sugerencias de prompt con {model}",
	"setup.suggestions_off": "desactivadas",
	"setup.suggestions_pkg_missing": "(paquete sin instalar)",
	// ---- bond setup: resumen final ----
	"setup.summary": `  {logo}

  Agentes:        {agents}  (por defecto: {default})
  Endpoints:      {endpoints}
  Configuración:  {config}
  Sugerencias:    {suggestions}  (bond setup --no-suggestions para apagarlas)
{icons}  Instrucciones:  {personal}  (edítalas y repite bond setup para propagarlas)
  Comprobar:      bond doctor

  Siguiente: cd <tu-repo> && bond init`,
	"setup.endpoints_none": "ninguno (cada agente usa su proveedor)",
	"setup.icons_line": "  Iconos del pie: {icons}  ([ui] icons en la configuración, o BOND_ICONS)\n",
	"setup.icon.nerd": "Nerd Font",
	"setup.icon.emoji": "emojis",
	"setup.icon.unicode": "Unicode",
	// ---- bond setup: instrucciones en cada agente ----
	"setup.instructions": "instrucciones {agent}: {result}{why}",
	"setup.instr.updated": "actualizado",
	"setup.instr.current": "al día",
	"setup.instr.skipped": "omitido",
	"setup.instr.symlink": "es un enlace: no se escribe a través de él (bond migrate convierte los de bond 0.7)",
	// ---- bond setup: skill de Herdr ----
	"setup.herdr_installing": "Instalando el skill de Herdr en pi",
	"setup.herdr_shared": "skill de Herdr: uso el compartido {path}",
	"setup.herdr_mismatch": "el skill compartido no coincide con 'herdr --skill' de la versión instalada;",
	"setup.herdr_update": "actualízalo con: npx skills update herdr (o herdr --skill > {path})",
	"setup.herdr_removing_dup": "quitando la copia duplicada {dir}",
	"setup.herdr_local_changes": "{file} tiene cambios locales y colisiona con el compartido; revísalo a mano",
	// ---- bond setup: herramientas de contexto ----
	"setup.context_tools": "herramientas de contexto: {list}",
	"setup.context_tool_missing": "falta {cmd} ({why})",
	"setup.tool.rg": "ripgrep: tool grep de pi",
	"setup.tool.fd": "tool find de pi",
	"setup.tool.ast-grep": "skill code-context: bun add -g @ast-grep/cli@0.45.3",
	"setup.tool.uvx": "uv: servidor MCP duckduckgo",
	"setup.tool.jq": "repo-map del skill code-context (opcional)",
	// ---- bond setup: skills globales y plugin de agy ----
	"setup.global_skills": "Skills globales de bond (multiagente con Herdr)",
	"setup.agy_plugin": "plugin global de agy: {dir}",
	// ---- bond setup: integraciones de Herdr ----
	"setup.integrations": "Integraciones de Herdr",
	"setup.integration_current": "integración {name}: ya actual",
	"setup.integration_installed": "integración {name}: instalada",
	"setup.integration_failed": "integración {name}: {err} (abre {agent} una vez y repite bond setup)",
	// ---- bond setup: snippet en la config de Herdr ----
	"setup.herdr_config_has": "{file} ya tiene el bloque de bond; no lo duplico.",
	"setup.herdr_config_edit": "Para cambiarlo, edita herdr/config.snippet.toml y reemplaza el bloque a mano.",
	"setup.herdr_config_adding": "Añadiendo el snippet de Herdr a {file}",
	"setup.herdr_config_reload": "Servidor de Herdr no recargó la config (¿no está en marcha?). Reinícialo tú.",
	// ---- bond setup: bond en el PATH ----
	"setup.on_path": "bond en el PATH: {path}",
	"setup.other_bond": "hay otro 'bond' en el PATH ({current}); no lo toco. Usa {src}",
	"setup.no_bin_dir": "ninguno de ~/.local/bin, ~/bin o ~/.bun/bin está en el PATH; añade {dir} al PATH",
	"setup.dest_exists": "{dest} existe y no es este bond; no lo toco",
	"setup.linked": "bond en el PATH: {dest} -> {src}",

	// ---- asistente de bond setup ----
	"wizard.cancelled": "setup cancelado: no se ha cambiado nada",
	"wizard.lang_question": "Idioma / Language",
	"wizard.lang_es": "Español",
	"wizard.lang_en": "English",
	"wizard.lang_set": "Idioma: {lang} ([ui] lang en config.toml, o BOND_LANG)",
	"wizard.lang_from_env": "Idioma: {lang} (lo fija BOND_LANG; no se pregunta)",
	"wizard.models_which": "¿Qué modelos registrar?",
	"wizard.probing": "{name}: comprobando qué APIs sirve (la primera petición puede cargar el modelo)",
	"wizard.probed": "{name}: {apis}{reasoning}",
	"wizard.probed_none": "sin respuesta de chat",
	"wizard.reasoning": " · razona",
	"wizard.endpoints_configured": "Endpoints configurados: {list}",
	"wizard.local_use": "{name} detectado en {url} ({count} modelos). ¿Usarlo?",
	"wizard.add_another": "¿Añadir otro endpoint de modelos?",
	"wizard.add_first": "¿Añadir un endpoint de modelos? (puedes saltarlo y usar el proveedor propio de cada agente)",
	"wizard.no_continue": "No, seguir",
	"wizard.no_none": "No, ninguno",
	"wizard.opt_custom": "Compatible con OpenAI (llama-swap, vLLM, Ollama remoto…)",
	"wizard.opt_openai": "OpenAI",
	"wizard.base_url": "URL base (la que acaba en /v1)",
	"wizard.base_url_placeholder": "http://mi-pasarela:8080/v1",
	"wizard.base_url_invalid": "tiene que empezar por http:// o https://",
	"wizard.key_openai": "Clave de la API (se guarda en ~/.bond/keys, permisos 600)",
	"wizard.key_optional": "Clave, si la pide (vacío si no)",
	"wizard.key_required": "OpenAI necesita clave",
	"wizard.reading_models": "Leyendo la lista de modelos",
	"wizard.models_count": "{count} modelos",
	"wizard.no_answer": "no responde",
	"wizard.endpoint_dead": "{url}/models no responde o no es compatible con OpenAI",
	"wizard.endpoint_name": "Nombre corto para este endpoint",
	"wizard.endpoint_name_invalid": "minúsculas, dígitos, - o _",
	"wizard.no_agents_note": "No hay ningún agente instalado: instala al menos uno",
	"wizard.agents_which": "¿Con qué agentes quieres trabajar?",
	"wizard.agents_missing": "No instalados: {list} (bond setup los detectará cuando los instales)",
	"wizard.agent_default": "¿Agente por defecto? (el que propone bond init y abre bond)",
	"wizard.suggestions_off_flag": "Sugerencias de prompt: desactivadas (--no-suggestions)",
	"wizard.suggestions_no_models": "Sugerencias de prompt: el registro de bond no tiene modelos para pi; quedan desactivadas",
	"wizard.suggestions_ask": "¿Sugerencias de prompt en pi? (ghost text con el siguiente prompt al terminar cada turno)",
	"wizard.suggestions_state": "Sugerencias de prompt: {state} con {model}",
	"wizard.on": "activadas",
	"wizard.off": "desactivadas",
	"wizard.fonts_more": " y {count} más",
	"wizard.icons_unicode": "Iconos del pie de pi: Unicode (lo dice [ui] icons en config.toml)",
	"wizard.icons_no_nerd": "Iconos del pie de pi: emojis (no hay ninguna Nerd Font instalada)",
	"wizard.icons_ask": "Hay Nerd Fonts instaladas ({fonts}). ¿Usar sus iconos en el pie de pi? (tu terminal tiene que usar una; si no, verías cuadrados: entonces di que no y saldrán emojis)",
	"wizard.icons_state": "Iconos del pie de pi: {label}",
	"wizard.herdr_installed": "Herdr instalado",
	"wizard.herdr_missing": "Herdr no está instalado (hace falta para abrir el puesto de trabajo con `bond`)",
	"wizard.herdr_more": "Más opciones: https://herdr.dev/docs/install/",
	"wizard.herdr_continue": "¿Seguir sin Herdr? (lo demás se configura igual)",
	"wizard.herdr_install_first": "Instala Herdr y vuelve a lanzar bond setup",
	"wizard.agent_install_first": "Instala un agente y vuelve a lanzar bond setup",
} as const;

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
	// ---- bond setup: help and options ----
	"setup.help": `Usage: bond setup [options]

Sets bond up on this machine (once; rerun it to change anything):

  1. Herdr: if it is missing, explains how to install it.
  2. Model endpoints: detects Ollama and LM Studio and asks about others (OpenAI or
     OpenAI-compatible). Keys are stored in ~/.bond/keys (permissions 600).
  3. Agents: which ones to work with (from those installed; at least one is required) and
     which one by default.
  4. Apply: models in each agent, prompt suggestions in pi, Herdr integrations, global
     skills and your instructions (~/.bond/AGENTS.md) in each agent (in Antigravity, in a
     global plugin: ~/.gemini/config/plugins/bond).

  --yes            No questions: use what was detected and already configured
  --lang <es|en>   Console language without asking
  --no-suggestions Do not enable pi's prompt suggestions
  --herdr-config   Add the Herdr snippet to ~/.config/herdr/config.toml
  --dry-run        Ask, but only show what applying would do
  -h, --help       This help`,
	"setup.unknown_opt": "unknown option: {opt} (bond setup --help)",
	"config.migrated": "global configuration moved from {from} to {to} (the old one stays as a copy)",
	// ---- mensajes comunes (cli/util.mts) y de las sugerencias de prompt de pi ----
	"util.warn": "warning:",
	"util.failed": "failed: {cmd}",
	"util.write": "write {file}",
	"util.bond_block": "bond block in {file}",
	"util.already_linked": "already linked: {path}",
	"util.linked": "linked: {dest} -> {src}",
	"util.exists_backed_up": "{dest} already exists; keeping it as {bak}",
	"suggestions.enabled_models": "pi's enabledModels: {state}",
	"suggestions.em_not_set": '["*"] (was missing)',
	"suggestions.em_already": "already set, kept",
	"suggestions.note_em_already": "pi's enabledModels was already set",
	"suggestions.note_declared": "{name} was already declared in pi's config",
	"setup.installing_deps": "Installing bond's dependencies (npm ci, no scripts)",
	"setup.need_npm_or_bun": "npm or bun is required to install bond's dependencies",
	"setup.applying": "Applying",
	"setup.ready_short": "ready",
	"setup.pi_extensions": "pi Bond Extensions: {path} (repos load them with bond init)",
	"setup.suggestions_on": "pi: prompt suggestions with {model}",
	"setup.suggestions_off": "off",
	"setup.suggestions_pkg_missing": "(package not installed)",
	// ---- bond setup: final summary ----
	"setup.summary": `  {logo}

  Agents:         {agents}  (default: {default})
  Endpoints:      {endpoints}
  Configuration:  {config}
  Suggestions:    {suggestions}  (bond setup --no-suggestions turns them off)
{icons}  Instructions:   {personal}  (edit them and rerun bond setup to propagate)
  Check:          bond doctor

  Next: cd <your-repo> && bond init`,
	"setup.endpoints_none": "none (each agent uses its own provider)",
	"setup.icons_line": "  Footer icons:   {icons}  ([ui] icons in the config, or BOND_ICONS)\n",
	"setup.icon.nerd": "Nerd Font",
	"setup.icon.emoji": "emojis",
	"setup.icon.unicode": "Unicode",
	// ---- bond setup: instructions in each agent ----
	"setup.instructions": "instructions {agent}: {result}{why}",
	"setup.instr.updated": "updated",
	"setup.instr.current": "up to date",
	"setup.instr.skipped": "skipped",
	"setup.instr.symlink": "it is a symlink: bond does not write through it (bond migrate converts bond 0.7 links)",
	// ---- bond setup: Herdr skill ----
	"setup.herdr_installing": "Installing the Herdr skill for pi",
	"setup.herdr_shared": "Herdr skill: using the shared one at {path}",
	"setup.herdr_mismatch": "the shared skill does not match 'herdr --skill' from the installed version;",
	"setup.herdr_update": "update it with: npx skills update herdr (or herdr --skill > {path})",
	"setup.herdr_removing_dup": "removing the duplicate copy at {dir}",
	"setup.herdr_local_changes": "{file} has local changes and clashes with the shared one; review it by hand",
	// ---- bond setup: context tools ----
	"setup.context_tools": "context tools: {list}",
	"setup.context_tool_missing": "missing {cmd} ({why})",
	"setup.tool.rg": "ripgrep: pi's grep tool",
	"setup.tool.fd": "pi's find tool",
	"setup.tool.ast-grep": "code-context skill: bun add -g @ast-grep/cli@0.45.3",
	"setup.tool.uvx": "uv: duckduckgo MCP server",
	"setup.tool.jq": "repo-map of the code-context skill (optional)",
	// ---- bond setup: global skills and agy plugin ----
	"setup.global_skills": "bond global skills (multi-agent with Herdr)",
	"setup.agy_plugin": "agy global plugin: {dir}",
	// ---- bond setup: Herdr integrations ----
	"setup.integrations": "Herdr integrations",
	"setup.integration_current": "integration {name}: already current",
	"setup.integration_installed": "integration {name}: installed",
	"setup.integration_failed": "integration {name}: {err} (open {agent} once and rerun bond setup)",
	// ---- bond setup: snippet in Herdr's config ----
	"setup.herdr_config_has": "{file} already has the bond block; not duplicating it.",
	"setup.herdr_config_edit": "To change it, edit herdr/config.snippet.toml and replace the block by hand.",
	"setup.herdr_config_adding": "Adding the Herdr snippet to {file}",
	"setup.herdr_config_reload": "The Herdr server did not reload its config (is it not running?). Restart it yourself.",
	// ---- bond setup: bond on PATH ----
	"setup.on_path": "bond on the PATH: {path}",
	"setup.other_bond": "there is another 'bond' on the PATH ({current}); leaving it alone. Use {src}",
	"setup.no_bin_dir": "none of ~/.local/bin, ~/bin or ~/.bun/bin is on the PATH; add {dir} to it",
	"setup.dest_exists": "{dest} exists and is not this bond; leaving it alone",
	"setup.linked": "bond on the PATH: {dest} -> {src}",

	// ---- bond setup wizard ----
	"wizard.cancelled": "setup cancelled: nothing was changed",
	"wizard.lang_question": "Idioma / Language",
	"wizard.lang_es": "Español",
	"wizard.lang_en": "English",
	"wizard.lang_set": "Language: {lang} ([ui] lang in config.toml, or BOND_LANG)",
	"wizard.lang_from_env": "Language: {lang} (set by BOND_LANG; not asked)",
	"wizard.models_which": "Which models to register?",
	"wizard.probing": "{name}: checking which APIs it serves (the first request may load the model)",
	"wizard.probed": "{name}: {apis}{reasoning}",
	"wizard.probed_none": "no chat response",
	"wizard.reasoning": " · reasons",
	"wizard.endpoints_configured": "Configured endpoints: {list}",
	"wizard.local_use": "{name} detected at {url} ({count} models). Use it?",
	"wizard.add_another": "Add another model endpoint?",
	"wizard.add_first": "Add a model endpoint? (you can skip it and use each agent's own provider)",
	"wizard.no_continue": "No, continue",
	"wizard.no_none": "No, none",
	"wizard.opt_custom": "OpenAI-compatible (llama-swap, vLLM, remote Ollama…)",
	"wizard.opt_openai": "OpenAI",
	"wizard.base_url": "Base URL (the one ending in /v1)",
	"wizard.base_url_placeholder": "http://my-gateway:8080/v1",
	"wizard.base_url_invalid": "it must start with http:// or https://",
	"wizard.key_openai": "API key (stored in ~/.bond/keys, permissions 600)",
	"wizard.key_optional": "Key, if it asks for one (empty if not)",
	"wizard.key_required": "OpenAI needs a key",
	"wizard.reading_models": "Reading the model list",
	"wizard.models_count": "{count} models",
	"wizard.no_answer": "not responding",
	"wizard.endpoint_dead": "{url}/models does not answer or is not OpenAI-compatible",
	"wizard.endpoint_name": "Short name for this endpoint",
	"wizard.endpoint_name_invalid": "lowercase letters, digits, - or _",
	"wizard.no_agents_note": "No agent is installed: install at least one",
	"wizard.agents_which": "Which agents do you want to work with?",
	"wizard.agents_missing": "Not installed: {list} (bond setup will detect them once you install them)",
	"wizard.agent_default": "Default agent? (the one bond init proposes and bond opens)",
	"wizard.suggestions_off_flag": "Prompt suggestions: off (--no-suggestions)",
	"wizard.suggestions_no_models": "Prompt suggestions: bond's registry has no models for pi; left off",
	"wizard.suggestions_ask": "Prompt suggestions in pi? (ghost text for the next prompt at the end of each turn)",
	"wizard.suggestions_state": "Prompt suggestions: {state} with {model}",
	"wizard.on": "on",
	"wizard.off": "off",
	"wizard.fonts_more": " and {count} more",
	"wizard.icons_unicode": "pi footer icons: Unicode (set by [ui] icons in config.toml)",
	"wizard.icons_no_nerd": "pi footer icons: emojis (no Nerd Font installed)",
	"wizard.icons_ask": "Nerd Fonts are installed ({fonts}). Use their icons in the pi footer? (your terminal has to be using one; otherwise you would see squares: say no and you get emojis)",
	"wizard.icons_state": "pi footer icons: {label}",
	"wizard.herdr_installed": "Herdr installed",
	"wizard.herdr_missing": "Herdr is not installed (needed to open the workstation with `bond`)",
	"wizard.herdr_more": "More options: https://herdr.dev/docs/install/",
	"wizard.herdr_continue": "Continue without Herdr? (everything else still gets configured)",
	"wizard.herdr_install_first": "Install Herdr and run bond setup again",
	"wizard.agent_install_first": "Install an agent and run bond setup again",
};

const CATALOGS: Record<Lang, Record<MessageKey, string>> = { es, en };

let current: Lang | undefined;

/** Idioma del proceso, resuelto una vez: leer config.toml en cada mensaje no sale a cuenta. */
export function lang(): Lang {
	if (!current) current = resolveLang();
	return current;
}

/** Forzar el idioma del proceso (los tests y el asistente nada más preguntarlo, antes de guardar). */
export function setLang(next: Lang): void {
	current = next;
}

/** Texto en el idioma del proceso, con `{param}` sustituido. Un parámetro ausente se deja tal cual. */
export function t(key: MessageKey, params: Record<string, string | number> = {}, at: Lang = lang()): string {
	return CATALOGS[at][key].replace(/\{([\w-]+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Todas las claves (para comprobar en los tests que los dos catálogos dicen lo mismo). */
export const MESSAGE_KEYS = Object.keys(es) as MessageKey[];
