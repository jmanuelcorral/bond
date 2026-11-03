/**
 * Textos que bond GENERA EN FICHEROS para los agentes, en los dos idiomas que soporta.
 *
 * No son consola: son las reglas globales que cada agente lee en su fichero de instrucciones,
 * el bloque `bond:hub` del `AGENTS.md` y la nota de coordinación que viaja en cada encargo de
 * una rama vertical. Van aquí y no en las áreas de consola para que la distinción se mantenga
 * (ver el comentario de cabecera de cli/messages.mts).
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla.
 *
 * Dos cosas no se traducen nunca (G4): los caminos (`docs/plans/`, `docs/decisions/`,
 * `hub.toml`, `~/.bond/AGENTS.md`) y los comandos de bond y de Herdr. Son literales que el
 * lector tiene que poder copiar tal cual.
 */

export const es = {
	// ---- reglas globales que bond pone en el fichero de instrucciones de cada agente ----
	"gen.rules": `## Bond: Herdr y otros agentes

- Puedes estar dentro de un panel de Herdr (\`HERDR_ENV=1\`). Usa Herdr (paneles, otros agentes,
  workspaces, worktrees) solo cuando el usuario lo pida o lo pida un comando como /delegate o
  /team; no por iniciativa propia porque algo tarde o se pueda paralelizar. El skill \`herdr\`
  explica cómo; la sintaxis la manda \`herdr <grupo>\`.
- Para delegar en otro agente o repartir trabajo en worktrees, usa los skills
  \`bond-delegate\` y \`bond-team\`.
- No cierres workspaces, paneles, agentes ni sesiones que no hayas creado tú. No ejecutes
  \`herdr\` sin subcomando.
- No mandes código ni datos privados a búsquedas web: busca el mensaje de error, no el fichero.
- Si el repo tiene una sección \`[decisions]\` en \`.bond/bond.toml\` (memoria de decisiones),
  registra las decisiones no triviales con el skill \`decision-record\` y pon los trailers
  \`Agent:\` y \`Decision:\` en los commits.`,

	// ---- semilla de ~/.bond/AGENTS.md (solo se escribe si no existe; despues es del usuario) ----
	"gen.personal_template": `# Mis instrucciones para todos los agentes

<!-- bond las lleva al fichero de instrucciones global de cada agente (bond setup).
     Idioma, estilo, cómo trabajas, reglas de git... -->
`,

	// ---- notas del marcador de bloque: NO van traducidas, y no es un olvido ----
	// La nota es metadato del marcador, no prosa que lea el agente. Traducirla hace que lo
	// commiteado dependa del idioma que detecta cada maquina, y eso rompe `bond sync --check` en
	// cualquier CI que no fije el idioma: bloque commiteado en es, runner detectando en, y el
	// aviso de G2 ni salta porque los manifiestos de bond <= 1.11 no traen `lang`. Las notas
	// quedan fijas en cli/instructions.mts y cli/repo.mts. Lo que si sigue el idioma es el
	// contenido: reglas, bloque del hub y nota de coordinacion.

	// ---- bloque bond:hub del AGENTS.md ----
	"gen.hub_title": "## El hub: sesión y reglas",
	"gen.hub_intro": `Este repo es un hub de bond: agrupa la sesión declarada en \`hub.toml\` —el hub y sus repos
enlazados— y sirve de puesto desde el que coordinarlos. Este bloque lo generan \`bond sync\`,
\`bond hub init\` y \`bond hub add\` a partir de \`hub.toml\`: no lo edites aquí; si cambia la
sesión, cambia \`hub.toml\` y pasa \`bond sync\`.`,
	"gen.hub_repos_title": "### Repos de la sesión",
	"gen.hub_is_hub": "*(el hub)*",
	"gen.hub_link_submodule": "submodule",
	"gen.hub_col_repo": "REPO",
	"gen.hub_col_path": "RUTA",
	"gen.hub_col_base": "BASE",
	"gen.hub_col_link": "ENLACE",
	"gen.hub_col_agent": "AGENTE",
	"gen.hub_col_description": "DESCRIPCIÓN",
	"gen.hub_rules_title": "### Reglas del hub",
	"gen.hub_rule_no_edit": `- No edites los repos enlazados (\`repos/\`) desde el hub: cada repo tiene sus propias reglas
  y su agente. El trabajo en un repo va por \`bond team <rama>\` —una rama vertical, un agente
  por repo—, en el worktree de ese repo.`,
	"gen.hub_rule_coordinate": `- En el hub se coordina la sesión: los planes viven en \`docs/plans/\` y las decisiones en
  \`{decisionsDir}/\`; desde aquí se lanza el trabajo sobre los repos y se revisa lo que vuelve.`,
	"gen.hub_rule_check": `- \`bond hub check\` revisa el estado de cada repo de la sesión y \`bond hub sync\` deja el disco
  como dice \`hub.toml\`.`,

	// ---- nota de coordinación del encargo de una rama vertical ----
	"gen.vertical_head": "[equipo vertical] Trabajas en {repo}, en la rama {branch} del hub {hub}; commitea solo en ese repo.",
	"gen.vertical_alone": " Eres el único agente de la rama.",
	"gen.vertical_others": " En la misma rama: {others}. Lo que cruce de un repo a otro (contratos, API, tipos) tiene que encajar con lo suyo: dilo en tu informe.",
	"gen.vertical_other_entry": "{name} en {repo} ({path})",

	// ---- aviso de cambio de idioma en bond sync ----
	// Sin concordancia de numero: t() solo sustituye {nombre}, no tiene plurales. La cuenta va
	// entre parentesis y la frase se sostiene en los dos idiomas.
	"gen.lang_rewritten": "idioma cambiado a {lang}: bloques de instrucciones reescritos ({count})",
	"gen.lang_check": "bloque en {from}, idioma en vigor {to}: {path}",
} as const;

export const en: Record<keyof typeof es, string> = {
	// ---- global rules bond writes into each agent's instructions file ----
	"gen.rules": `## Bond: Herdr and other agents

- You may be inside a Herdr pane (\`HERDR_ENV=1\`). Use Herdr (panes, other agents, workspaces,
  worktrees) only when the user asks for it or a command such as /delegate or /team asks; not on
  your own initiative because something is slow or could be parallelised. The \`herdr\` skill
  explains how; \`herdr <group>\` is the syntax.
- To delegate to another agent or split work across worktrees, use the \`bond-delegate\` and
  \`bond-team\` skills.
- Do not close workspaces, panes, agents or sessions you did not create. Do not run \`herdr\`
  without a subcommand.
- Do not send code or private data to web searches: search the error message, not the file.
- If the repo has a \`[decisions]\` section in \`.bond/bond.toml\` (decision memory), record
  non-trivial decisions with the \`decision-record\` skill and add the \`Agent:\` and \`Decision:\`
  trailers to commits.`,

	// ---- seed for ~/.bond/AGENTS.md (written only if missing; afterwards it belongs to the user) ----
	"gen.personal_template": `# My instructions for all agents

<!-- bond carries them into each agent's global instructions file (bond setup).
     Language, style, how you work, git rules... -->
`,


	// ---- bond:hub block in AGENTS.md ----
	"gen.hub_title": "## The hub: session and rules",
	"gen.hub_intro": `This repo is a bond hub: it groups the session declared in \`hub.toml\` —the hub and its linked
repos— and serves as the station you coordinate them from. \`bond sync\`, \`bond hub init\` and
\`bond hub add\` generate this block from \`hub.toml\`: do not edit it here; if the session
changes, change \`hub.toml\` and run \`bond sync\`.`,
	"gen.hub_repos_title": "### Session repos",
	"gen.hub_is_hub": "*(the hub)*",
	"gen.hub_link_submodule": "submodule",
	"gen.hub_col_repo": "REPO",
	"gen.hub_col_path": "PATH",
	"gen.hub_col_base": "BASE",
	"gen.hub_col_link": "LINK",
	"gen.hub_col_agent": "AGENT",
	"gen.hub_col_description": "DESCRIPTION",
	"gen.hub_rules_title": "### Hub rules",
	"gen.hub_rule_no_edit": `- Do not edit the linked repos (\`repos/\`) from the hub: each repo has its own rules and its
  own agent. Work in a repo goes through \`bond team <branch>\` —one vertical branch, one agent
  per repo—, in that repo's worktree.`,
	"gen.hub_rule_coordinate": `- The hub is where the session is coordinated: plans live in \`docs/plans/\` and decisions in
  \`{decisionsDir}/\`; from here you launch work on the repos and review what comes back.`,
	"gen.hub_rule_check": `- \`bond hub check\` reviews the state of each repo in the session and \`bond hub sync\` makes the
  disk match \`hub.toml\`.`,

	// ---- coordination note carried by each vertical-branch request ----
	"gen.vertical_head": "[vertical team] You work in {repo}, on branch {branch} of the hub {hub}; commit only in that repo.",
	"gen.vertical_alone": " You are the only agent on the branch.",
	"gen.vertical_others": " On the same branch: {others}. Anything that crosses from one repo to another (contracts, API, types) has to line up with theirs: say so in your report.",
	"gen.vertical_other_entry": "{name} in {repo} ({path})",

	// ---- language-change notice in bond sync ----
	"gen.lang_rewritten": "language switched to {lang}: instruction blocks rewritten ({count})",
	"gen.lang_check": "block in {from}, current language {to}: {path}",
};
