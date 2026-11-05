# Cambios

## 1.13.1

Publicación en npm con identidad propia: trusted publishing por OIDC y tarball firmado con
provenance, sin depender ya de un token de larga vida para autorizar el publish. Además los
mensajes de `bond update` dejan de anunciar que el paquete no existe, porque desde la 1.13.0 sí
existe.

- `@jmanuelcorral/bond` se publica en npm por **trusted publishing** y con **provenance** (#66).
  El `release.yml` pide `id-token: write` para que GitHub cuñe el OIDC token, fija Node 24 con
  `actions/setup-node` (trusted publishing exige npm ≥ 11.5.1 y `ubuntu-latest` trae 10.9.9, que
  no habla OIDC) y publica con `--access public --provenance`, de modo que el tarball queda firmado
  con una attestation que lo enlaza con este commit y esta workflow. El secret `NPM_TOKEN` se
  mantiene como red de seguridad: npm detecta el entorno OIDC y lo usa antes de mirar tokens
  tradicionales, así que el token ya no es lo que autoriza el publish.

- Los mensajes de `bond update` dejan de decir que `@jmanuelcorral/bond` no está publicado (#66).
  Con el paquete ya en npm desde la 1.13.0, una instalación por npm recibe el comando de la
  versión concreta (`npm i -g @jmanuelcorral/bond@X.Y.Z`) en vez del `.tgz` de la release.
  Cambian `update.manual_npm` (español e inglés), el texto de ayuda de `bond update`, el
  comentario de `manualCommand` en `cli/update.mts` —que deja de recibir `base`, porque ya nada
  depende del URL de la release— y las secciones de actualización de `docs/reference.md` y
  `docs/en/reference.md`.
- La skill `release-bond` incorpora lo aprendido al publicar la 1.13.0: el `NPM_TOKEN` tiene que
  ser de tipo Automation (uno «Read and write» con 2FA responde `EOTP` y CI no puede producir el
  código de un solo uso), `gh release create` no es idempotente —un fallo aguas abajo solo se
  reintenta borrando la release con `--cleanup-tag` y rehaciendo el tag, lo que recompila los
  binarios y cambia todas las sumas— y el aviso de «no publicado» ya está volteado: si npm dejara
  de publicar, se arregla la publicación, no se vuelve a escribir el texto viejo.

## 1.13.0

Semáforos en la memoria de decisiones y aprovisionamiento de modelos por selección. Un agente ya
no puede aceptarse sus propias decisiones: `accepted_via` pasa a significar quién aceptó, `accept`,
`reject` y `supersede` se niegan si quien ejecuta es quien registró la decisión, y `bond decisions
check` y `bond doctor` sacan los registros auto-aceptados. `bond models sync` deja de escribir en
agentes que no elegiste, Codex pasa a usar su cuenta oficial con limpieza automática del bloque
huérfano, y la forma TOML `[[providers]]` se rechaza teniendo delante la canónica. Y por primera vez
bond se publica en npm como `@jmanuelcorral/bond`: el mismo `.tgz` que se adjunta a la release.

- Semántica de `accepted_via`, bloqueo por identidad y comando de migración de decisiones (#82).
  `accepted_via` pasa a representar quién aceptó la decisión en lugar de quién ejecutó el comando:
  con `--confirmed-by` se escribe `"user"`, mientras que el agente ejecutor queda registrado en `decided_by`
  y en el trailer `Agent:` del commit. `accept`, `reject` y `supersede` se niegan si el agente que ejecuta
  coincide con `decided_by`, bloqueando que un agente pueda auto-aceptarse una decisión citando texto de un
  encargo. `bond decisions check` y `bond doctor` auditan y marcan como error los registros `accepted` con
  `decided_by == accepted_via`. El nuevo subcomando `bond decisions migrate` actualiza de forma idempotente
  las decisiones `accepted` históricas con `accepted_via` no vacío a `"user"`, respetando las aceptadas en
  terminal (vacías) y las que ya tienen `"user"`, con soporte de `--dry-run` y `--json`.

- Rechazo explícito de la forma `[[providers]]` y claves de proveedor puramente numéricas (#77).
  Si el usuario escribe los proveedores como array de tablas de TOML (`[[providers]]`) o define una
  clave puramente numérica (`[providers.0]`), `loadConfig()` falla inmediatamente con un mensaje claro
  que muestra la forma canónica esperada (`[providers.<id>]` y sus `[[providers.<id>.models]]`) junto
  a un ejemplo de migración, en lugar de aceptar índices numéricos silenciosamente como nombres de
  proveedor y buscar claves de autenticación en rutas inexistentes como `~/.bond/keys/0`. Un array vacío
  inline (`providers = []`) se acepta sin error como configuración sin proveedores.
- `bond models sync` respeta la selección de agentes de `cfg.agents` (#73). Sin `--agent`, sincroniza
  únicamente los agentes seleccionados por el usuario que estén instalados en la máquina, en vez de
  escribir proveedores en todos los agentes instalados. `--agent <a>` sigue forzando la sincronización
  de un agente concreto. La comprobación con `--check` y `bond doctor` adopta el mismo criterio: solo
  auditan los agentes configurados.
- Codex se soporta con su cuenta oficial y bond deja de aprovisionarlo (#80). Se elimina de `TARGETS`,
  del aprovisionamiento de `bond setup` y de la comprobación de modelos en `bond doctor`. Codex sigue
  siendo plenamente seleccionable en `bond init` y `bond setup`, se lanza igual con `bond launch`,
  recibe instrucciones `AGENTS.md` y su bloque MCP de repo en `.codex/config.toml` permanece intacto.
  Para usuarios existentes, `bond models sync` barre automáticamente el bloque huérfano `# >>> bond >>>`
  en `~/.codex/config.toml` con backup `.bak.<STAMP>` y preservando cualquier configuración manual
  alrededor de forma idempotente. `bond models list` añade una línea informativa explicando que Codex
  utiliza su cuenta oficial, pero solo si Codex está en tu selección de `bond setup` o instalado en la
  máquina: para quien no lo usa no es información, es ruido.
  La limpieza corre siempre, también cuando se pasa `--agent`: `bond models sync --agent codex` limpia
  ese bloque en lugar de morir con «agente sin generador de modelos», y `bond doctor` saca una fila de
  aviso mientras el bloque siga en el disco (se resuelve con `bond models sync`). Sin bloque, `doctor`
  no dice nada y `--agent codex` lo hace constar en una línea.
- `release-bond`, la skill del catálogo que convierte el publicar bond en un procedimiento con
  puertas (#66). Los cuatro pasos reales —versión, tag y changelog; la release que compila
  `release.yml`; `bun scripts/packaging.mts`; y la fórmula en el tap `jmanuelcorral/homebrew-tap`,
  que es otro repo— estaban solo en prosa en `AGENTS.md`. La skill deja escritas las comprobaciones
  que evitan los errores caros: no lanzar el packaging antes de que la release esté publicada y
  completa (el generador lee `SHA256SUMS` de la release, no de `dist/`), que el tag coincida con
  `package.json` antes de empujar, verificar las sumas contra lo descargado de verdad y que los
  hashes del `.rb` del tap sean los de la release. Incluye qué hacer cuando algo se rompe a
  mitad. Es una skill de mantenedor: `default = false`, para que `bond init` no se la instale en
  cualquier repo.
- `release.yml` publica `@jmanuelcorral/bond` en npm cuando existe el secret `NPM_TOKEN` (#66).
  Publica el mismo `.tgz` que se adjunta a la release, no un `npm pack` nuevo: comprueba su
  SHA-256 contra `SHA256SUMS` antes de subirlo y fija el registry en `registry.npmjs.org`, porque
  una entrada `@jmanuelcorral:registry` en cualquier `.npmrc` tiene prioridad sobre la opción
  `--registry` y puede desviar el paquete a GitHub Packages. Sin el secret, el paso se salta con
  un aviso en el resumen de la run y la release se crea exactamente igual que hoy. `--provenance`
  no va todavía: exige trusted publishing configurado en npm por paquete, y se anotó como
  seguimiento en la skill.

Tres skills propias del repo, en `.agents/skills/`, para quien se lo baje. No son del catálogo: no
están declaradas en el array `skills` de `.bond/bond.toml`, así que `bond init` no las instala en
otros proyectos. `bond sync` sí las enlaza a `.claude/skills/` y viajan versionadas con el repo.

- `ci-status`: estado de la pipeline de GitHub en una sola llamada, y sobre todo, distinción entre
  fallo de código y capricho de la infraestructura (#64). Un `cancelled` porque el runner se cayó no
  es un fallo tuyo, y tratarlo como tal manda a buscar un bug que no existe. Sin dependencias: Node
  ≥ 22 y `gh`; los comandos van con argv, nunca con string de shell, para que no haya problemas de
  comillas ni de separadores en Windows. `--watch` bloquea hasta el veredicto, `--log` saca la causa
  del fallo sin abrir el navegador, `--rerun-failed` reejecuta solo lo caído y `--json` da salida de
  máquina. El refino por log se limita a cinco fallos porque cada uno cuesta una llamada a la API.
- `merge-and-clean`: fusionar con rebase y borrar las ramas sin perder nada por el camino (#65).
  Verifica la integración con `git cherry` — equivalencia de parches, no SHA — antes de borrar nada,
  porque tras un rebase los SHA se reescriben y `git log main..rama` dice que hay pendientes cuando
  no los hay. Nunca borra `main`, ni la rama actual, ni una rama con trabajo sin integrar (imprime
  el parche exacto), y si una rama está montada en un worktree lo reporta en vez de desmontarla: eso
  puede matar el panel de un agente que está trabajando ahí. Si `git cherry` falla tampoco borra, no
  se confunde «no se pudo comprobar» con «no hay pendiente». `--clean` barre de golpe las ramas
  locales fusionadas.
- `tui-design`: adaptada de [fluzo-labs/fluzo-skills](https://github.com/fluzo-labs/fluzo-skills)
  (MIT), movida de la configuración global al repo para que la tenga cualquiera que se lo baje. Su
  `ORIGIN.md` guarda el SHA de origen: la colección no se autoactualiza, cada actualización se revisa
  y se copia a mano.

## 1.12.0

El modo hub se puede operar de verdad. `bond hub exec` recorre la sesión entera con un comando,
`bond hub bump` mueve los punteros que el hub guarda de cada repo y `bond hub` enseña el estado en
vivo de cada uno. La tabla de `bond team` se redibuja entera: un único renderizador, rejilla, y en
el hub agrupa por rama vertical en vez de partir cada vertical en tres grupos. Y por primera vez lo
que bond escribe en los ficheros de los agentes sigue el idioma que elegiste en `bond setup`; hasta
ahora el idioma llegaba a la consola y nada más. De paso, las pruebas de hub se dejan de excusas en
Windows y se pasan de verdad.

- Lo que bond escribe en ficheros para los agentes sigue el idioma elegido en `bond setup` (#49).
  Hasta ahora el idioma (1.11.0) llegaba a la consola y nada más: las reglas globales que van al
  fichero de instrucciones de cada agente, el bloque `bond:hub` del `AGENTS.md` y la nota de
  coordinación que viaja en cada encargo de una rama vertical estaban en español fijo, aunque
  tuvieras `lang = "en"`. Esas ~25 cadenas viven ahora en un área nueva de mensajes
  (`cli/messages/gen.mts`, claves `gen.*`) y se resuelven en el idioma en vigor al generar. Son
  área aparte y no se han mezclado con las de consola porque son otra categoría: se generan en otro
  momento y lo lee el agente, no tú por una terminal. Tres cosas no se traducen nunca: los caminos
  (`docs/plans/`, `docs/decisions/`, `hub.toml`, `repos/`), los comandos de bond y de Herdr, que
  tienen que poder copiarse tal cual, y las notas del marcador («generado por bond sync; no editar»),
  que son metadato del marcador y no prosa para el agente: hacerlas depender del idioma acopla lo
  commiteado al locale que detecta cada máquina, y en esta misma PR reventó así `bond sync --check`
  en CI — bloque escrito en español, runner detectando inglés. Sí se traducen las cabeceras de la
  tabla del hub (`RUTA`→`PATH`, `ENLACE`→`LINK`, `AGENTE`→`AGENT`). Cambiar de idioma reescribe los bloques, y
  se dice: `bond sync` avisa de cuántos bloques reescribe y a qué idioma, y `bond sync --check` lo
  distingue de un bloque desactualizado genérico (`block in es, current language en: AGENTS.md`).
  Para eso el manifiesto guarda el idioma con que se escribió (`manifest.lang`); los manifiestos de
  bond ≤ 1.11 no lo tienen y no se dispara el aviso en vez de inventárselo. `~/.bond/AGENTS.md` no
  se migra: tras sembrarlo es tuyo, y cambiar de idioma después no lo toca — un aviso de cambio de
  idioma no es una orden de reescribir instrucciones personales. El español no cambia una coma: las
  cadenas `es` se copiaron tal cual de lo que ya se escribía, y hay pruebas que lo fijan.
- La tabla de `bond team` se dibuja con un único renderizador y se lee de otra manera (#33).
  Antes `status` y `--watch` tenian dos renderizadores distintos y en el hub la tabla agrupaba por
  estado, de modo que una vertical (`plan/pagos-p1` con front, back y docs) salia partida en tres
  grupos y no se veia como lo que es. Ahora: una sola funcion pinta ambas vistas; en el hub se
  agrupa por rama vertical y fuera por estado; el estado va como icono pegado al minion, no en una
  columna aparte; el pie lleva los totales derivados de lo que se ensena (nada guardado, nada que
  se desincronice) y, si no cabe, se caen primero los conteos y lo ultimo el `q o Ctrl+C para
  salir`. Al faltar ancho se sueltan columnas desde el final (`DÓNDE`, `FICHEROS`, `COMMITS`...) y
  se avisa debajo de la cabecera qué se ha caido; `MINION` y `RAMA` no se caen nunca. La tabla
  lleva rejilla dibujada con trazos Unicode (`U+2500..U+257F`, están en cualquier fuente): cabecera
  separada, una banda de título por grupo a todo el ancho y cierre inferior, para que se lea como la
  tabla que es y no como columnas de texto sueltas. La rejilla cuesta columnas (unas 16 con las cinco
  de siempre), así que el minimo pasó de 20 a 24: a 60, que es el ancho por el que se diseno, caben
  las cinco. Por debajo del minimo no se deforma nada: se dice que no cabe.
  Los iconos de estado salen del estilo que ya eligió `bond setup` en `[ui] icons` (o `BOND_ICONS`),
  igual que el pie de pi: con `nerd`, glifos propios de Nerd Font; con `unicode`, siqueros de una
  columna que trae cualquier fuente; con `emoji`, los de siempre. Antes la tabla hardcodeaba emojis
  aunque la configuracion dijera otra cosa. Las pruebas fijan el estilo a `emoji` en un preload
  (`test/icons-pinned.mts`) para no depender de si la máquina de quien las pasa tiene Nerd Font. `bond team status <rama>` da esa fila entera,
  sin truncar, para cuando la tabla no llega. `clip()` es ahora consciente de ANSI y de clusters: no
  deja una secuencia de color a medias ni despega un selector de variante (`✏️` partido). El color va
  solo en el icono y el estado, asi que sin color el contenido es identico. La tabla pinta el
  estado y nada mas: se ha quitado la linea `└ pregunta:` que llevabamos debajo de la fila bloqueada.
  Bond no lee las preguntas de los agentes: lo unico que sabe reconocer en un panel es el aviso de
  confianza de la carpeta del proyecto (`questionIn`) y eso devuelve una cadena fija, no lo que el
  agente ha escrito. Dejar esa linea era simular una capacidad que no tenemos. El icono ⛔ ya dice
  que el agente espera algo tuyo, el aviso de como responder se sigue imprimiendo bajo la tabla, y
  en `bond team status <rama>` sale la linea `espera:` con lo que se pudo detectar. De paso se ha
  corregido un fallo real: `teamRows`/`hubRows` hacian `agent_status !== "blocked" ? questionIn(...) :
  undefined`, de modo que cuando Herdr si marcaba el agente como blocked se descartaba el aviso de
  confianza, justo el caso en que importa. Se lee siempre: `questionIn` no casa el aviso de arranque
  de agy (eso lo aparta `startupNoticeIn`), asi que el filtro no protegia de nada.
- El bloque de fase de la plantilla de plan tiene campo `- Repos: front, back` (#44). Hasta ahora
  `plan-team` decía «los repos que la fase toca, según el plan» y `bond team --repos` existía, pero
  no había dónde escribirlo: cada agente lo ponía donde le parecía y quien leía adivinaba. El campo
  va dentro del bloque, junto a `Affected contracts`, con rutas o nombres de carpeta declarados en
  `hub.toml`. `plan-create` lo escribe y lo valida contra la sesión al planificar (`bond hub --json`),
  no cuando `bond team` falla al montar el equipo; `plan-team` lo lee para pasar `--repos` y, si la
  fase no lo tiene, pregunta qué repos abre — omitirlo no significa «todos»: un agente en un repo que
  no tocaba es peor que una pregunta. Fuera de un hub (sin `hub.toml`) el campo no aplica y se
  ignora con aviso. `bond team` ya fallaba si `--repos` nombra algo fuera de la sesión
  (`pickRepos`); se ha añadido la prueba que lo fija.
- `bond hub exec`: ejecuta un comando en el hub y en cada repo de la sesión, en ese orden y de
  forma secuencial, con cabecera por repo para que la salida no se entrelaza (#46). Puede ser
  destructivo: antes de ejecutar muestra el comando exacto y los repos afectados y pide
  confirmación una sola vez (`--yes`/`-y` la salta; sin terminal no ejecuta nada y dice cómo
  repetir; cancelada, sale con 130). La forma exige `--` antes del comando
  (`bond hub exec [opciones] -- <comando> [args...]`): todo lo posterior es el comando y bond no
  lo interpreta, por eso el comando arbitrario no choca con la lista blanca de opciones. El
  comando corre por defecto en argv, sin shell (nada de pipes, `&&` ni globs); `--shell` es
  opt-in y es la primera y única excepción con shell en bond (en Windows el shell es `cmd.exe`,
  con semántica distinta, y propagarlo por defecto a N repos es un riesgo). Un repo que falla no
  corta el resto: el exit code final es el peor (el máximo) de los devueltos, para que
  `bond hub exec -- npm test` sirva en scripts. El stdin del hijo apunta a `/dev/null` (`NUL` en
  Windows): si el comando intenta leer, recibe EOF al instante y nunca se cuelga bajo un agente.
  Los repos `not present` se omiten y se dicen; symlink y submodulo reciben el comando igual.
  `--dry-run` muestra el de-a sin ejecutar ni preguntar y `--json` da por repo comando, cwd,
  exit code, stdout y stderr más `confirmed` y el exit code global.
- `bond hub` muestra ahora el estado en vivo de cada repo de la sesión en una columna ESTADO
  compacta y con color: cambios sin commitear (`·N`), commits por delante del remoto (`N↑`) y
  por detrás (`N↓`); limpio y al día es un punto verde, sin upstream un simple `·`/`·N` y no
  presente un `-` (no está y HEAD separado se conservan tal cual). Es información neutra, no
  un veredicto: el diagnóstico con arreglo sigue siendo `bond hub check`. El estado se calcula
  contra las refs locales del remoto, sin tocar la red, y el pie de tabla lo indica; `--fetch`
  hace `git fetch` por repo para dar el dato fresco. `--json` añade por repo `dirty`, `ahead`,
  `behind`, `upstream` y `fetched`. El cálculo ahead/behind, que `check` y `pull` duplicaban,
  se extrae a `cli/hub-status.mts` y lo usan los tres (#42).
- `bond hub bump`: mueve el puntero (gitlink) que el hub guarda de cada repo de la sesión enlazado
  como submódulo al commit actual de su rama base y lo commitea en la rama actual del hub, sin push
  nunca: el commit queda local para revisarlo y empujarlo uno mismo (#43). Se apoya en `bond hub pull`
  (que avanza las refs de base desde el remoto): el flujo es `pull` y después `bump`. Por repo: al día
  si el puntero ya apunta a la base (nada commiteado); `no aplica` explícito en los enlazados por
  symlink (no hay gitlink que mover); saltado y explicado si el submódulo no está en disco, no figura
  en el índice del hub, su base no se resuelve, está sucio o su HEAD no coincide ni con el puntero del
  hub ni con su base (desincronizado). `--dry-run` muestra el de-a sin tocar nada y `--json` el
  resultado por repo. Aborta si el hub tiene cambios ya `staged`, para no commitear nada ajeno.
- La autoría de las decisiones (`decided_by`, `accepted_via`) se puede fijar a mano con
  `BOND_DECISION_AGENT` o con `[decisions] author` en `~/.bond/config.toml`, y manda sobre lo
  que bond deduce del panel. En un worktree delegado bond firma como el minion que arrancó ahí
  (`MINIONS` en `cli/team.mts`) y no como el orquestador con el que se habla; el override
  permite que el registro diga la identidad que importa. Vale `user` o
  `agent:<kind>[/<nombre>]` (`pi/gru` se normaliza a `agent:pi/gru`); un valor que no encaja
  muere en vez de escribirse a medias.
- Espacio de nombres único para worktrees de `bond team`: las carpetas en `~/.herdr/worktrees`
  llevan un sufijo hash corto derivado de la ruta absoluta del repositorio o hub (`<nombre>-<hash>`),
  evitando colisiones entre repositorios con la misma carpeta base (#36). Los worktrees existentes
  del esquema anterior se siguen reconociendo y limpiando con `bond team clean`.
- `bond hub init` con una sola ruta: esa ruta es el hub, no un repo a importar (#40). El
  comportamiento se mantiene pero deja de ser silencioso: fuera de un repo, si esa ruta única ya
  es un repo git que no es un hub, `bond` avisa antes de crear nada (y pregunta si hay
  terminal), y la ayuda documenta las formas explícitas `bond hub init . <ruta>` y
  `bond hub init --repo <ruta>`.
- `bond hub init` y `bond hub add` validan los orígenes antes de tocar disco (#35): un origen
  vacío (`file://`, `--repo ""`), una ruta que no existe o no es un repo git, un `--name` vacío
  o una clave de repo con puntos o barras fallan con un mensaje claro y ya no dejan un `hub.toml`
  inválido. En Windows los orígenes `file://C:\...` conservan el nombre del repo: se separaba la URL
  solo por `/` y la carpeta salía con nombre vacío, y las etiquetas de `hub.toml` se comparan ahora
  normalizadas por los dos lados de `relative()`, que daba rutas relativas absurdas entre unidades.
- `bond team` enruta los encargos al agente de la rama por el emparejamiento del panel y no por el
  directorio de trabajo (#37). `teamRows` y `sessionRows` buscaban al agente comparando el `cwd` del
  panel, y con worktrees de una misma repo o paneles abiertos después eso elegía a quien no era: el
  encargo se iba a un agente de otra rama sin manera de darse cuenta. Se usa ahora el emparejamiento
  (nombre y `pane_id`) fijado al crear el equipo; si no existe o está obsoleto se devuelve
  `undefined`, así que el comando falla diciendo que no hay a quién hablar en vez de elegir a ciegas.
- `bond team collect` recoge la última ejecución de la rama y lee la transcripción completa (#38).
  Las ejecuciones se ordenan por `started_at` para ir a la tarea más reciente de la rama y no a una
  anterior, y en las sesiones de `agy` se lee `transcript_full.jsonl`: con la transcripción recortada
  el informe salía truncado aunque el agente hubiera terminado del todo.
- `bond hub`, `bond hub sync`, `bond hub check` y `bond hub pull` distinguen «falta hub.toml» de
  «existe hub.toml pero no se puede leer» (#39): con un `hub.toml` que no parsea o no define la
  sesión, el error final dice que el fichero está ahí y lleva el error de parseo.

## 1.11.0

Bond se pone la ropa de la web y aprende a hablar en los dos idiomas. La terminal estrena el logo
del proyecto (el isotipo de los dos chevrones y la palabra `bond`, con su degradado índigo a
teal) y un pie de estado rediseñado con iconos, y toda la CLI sale en español o en inglés según
lo que elijas en `bond setup`.

- Logo nuevo en la terminal, el de la web: el isotipo (dos chevrones que se cruzan y se abren en
  tres trazas) en medios bloques, con el degradado del logo de índigo a teal, y la palabra `bond`
  en minúsculas. Sustituye a la palabra BOND con degradado magenta y campo de diagonales al
  estilo de Crush en la cabecera de pi, `bond logo` y la ayuda.
- El logo entra animado en la cabecera de pi, `bond logo` y la ayuda de `bond` (unos 2,4 s): el
  isotipo aparece de izquierda a derecha, se enciende la palabra y las ramas se recogen hasta
  dejar solo los chevrones `>>` junto a `bond`. Necesita 57 columnas; de 31 a 56 sale esa forma
  sin animar, y en paneles más estrechos, la línea de marca. Si la salida no es una terminal,
  el logo sale quieto y entero.
- Pie de estado de pi rediseñado: a la izquierda, la insignia de bond (`>>` en dos filas con el
  degradado del logo y `bond`) y cada dato con su icono. La barra de contexto es una línea
  fina y los separadores `·` desaparecen. En paneles estrechos se quitan primero los datos menos
  importantes en lugar de cortar la línea, y la insignia se queda en los `>>` (o desaparece por
  debajo de 50 columnas).
- `bond setup` busca Nerd Fonts instaladas y, si hay alguna, pregunta si usar sus iconos en el
  pie de pi; si no hay ninguna o dices que no, el pie usa emojis. Se guarda en `[ui] icons` de
  `~/.bond/config.toml`, y `BOND_ICONS` (`nerd`, `emoji` o `unicode`) manda sobre él.
- La línea de marca de `bond`, `bond team`, `bond setup` y `bond init` pasa a ser
  `»» bond texto ───▪` y ya no se sale del panel cuando es muy estrecho: recorta el texto.
- `bond setup` pregunta el idioma de la consola (español o inglés) al arrancar y lo guarda en
  `[ui] lang` de `~/.bond/config.toml`. Toda la CLI sale ya en ese idioma: la ayuda de `bond` y
  la de cada comando, los avisos y los mensajes de los nueve comandos (862 claves nuevas con su
  traducción). Si no hay nada configurado, bond arranca en el idioma del sistema (`LC_ALL`,
  `LANGUAGE`, `LC_MESSAGES`, `LANG`: español si empieza por `es`, inglés en cualquier otro
  caso). `BOND_LANG` manda por encima de lo guardado sin escribirlo, y `bond setup --lang es|en`
  lo fija sin preguntar, también con `--yes` y sin terminal. El flag se aplica antes de imprimir
  nada, así que `bond --lang en --help` ya sale en inglés. Lo que bond escribe para el agente
  (sus reglas y las skills) no cambia de idioma: eso se edita en `~/.bond/AGENTS.md`.

## 1.10.0

Llega el **modo hub**: un repo de operaciones que agrupa otros repos (como submódulos o como
symlinks a tus clones) y trabaja con ellos en vertical, con una rama del mismo nombre en todos y
un agente por repo. La web estrena diseño y una página de novedades con un vídeo del modo hub.

- **`hub.toml`**, la sesión del hub: el nombre y la base del hub y, por repo, `path`, `base`,
  `link = "submodule"` o `"symlink"`, `url`, `agent` y `description`. Las rutas a tus clones van
  en `.bond/hub.local.toml` (en `.gitignore`, admite `~`), y `~/.bond/hubs.toml` permite encontrar
  el hub desde un repo enlazado por symlink.
- **`bond hub init`**, asistente para crear un hub o prepararlo en un repo que ya existe:
  - primero hace `bond init` en el propio hub (con `plan-team` y la memoria de decisiones, para
    que los runs del equipo queden en el hub);
  - importa los submódulos que ya hubiera y añade repos por URL (submódulo) o desde un clon local
    (symlink), que se elige navegando por el disco; los repos nuevos van en `repos/<nombre>`;
  - hace `bond init` con la config del hub en los repos que no tienen bond (los que ya lo tienen
    conservan la suya) y commitea esa config si el repo estaba limpio; en un submódulo avisa de
    que ese commit hay que subirlo con `git push` antes que el hub;
  - deja un hub nuevo con su config generada y un commit inicial.
- **`bond hub add <url|ruta>`** añade un repo (`--path`, `--base`, `--link`, `--agent`,
  `--description`); **`bond hub sync`** deja el disco como dice `hub.toml` (junctions en Windows
  si no se puede crear el symlink) y hace el `bond init` que falte; **`bond hub`** enseña la
  sesión.
- **`bond hub check`** revisa cada repo de la sesión y dice cómo arreglar lo que falla: enlace,
  base, `bond init` y config, agentes, worktrees, cambios sin commitear y ramas verticales a
  medias. Los avisos (un repo fuera de `repos/`, una base atrasada respecto a su remoto) no
  cambian el código de salida. `--fix` arregla lo seguro (enlaces y submódulos sin iniciar),
  pregunta antes de cada cambio salvo con `--yes`, y nunca descarta cambios ni cambia de rama.
  `--json` da un `level` (`ok`, `warn` o `fail`) por comprobación, por repo y por informe, como
  `bond doctor`, que resume el hub en su fila.
- **`bond hub pull`** pone al día la base del hub y de cada repo con `git fetch` y avance solo en
  fast-forward; si la base no está en uso en ningún worktree (un submódulo con HEAD separado),
  avanza la rama sin tocar la carpeta de trabajo. Salta, explicando por qué, lo que tiene cambios
  o ha divergido; nunca hace merge, rebase ni push.
- En un hub, **`bond sync`** genera en su `AGENTS.md` un bloque (`bond:hub`) con la tabla de
  repos y las reglas del hub, para que el orquestador sepa qué es cada repo; lo que escribas fuera
  del bloque se conserva.
- **`bond team` en un hub**: `bond team fix/x` abre una rama vertical, con un worktree y un agente
  en cada repo de la sesión (o en los de `--repos`), cada uno desde su base; solo cabe una abierta
  a la vez. `bond team prompt` manda la tarea a todos con una nota que nombra a los demás agentes;
  `collect --repo` guarda los runs en el hub y `clean` lo deja todo como estaba. `status` y la
  tabla en vivo (`tabla · <hub>`) enseñan toda la sesión, también desde dentro de un repo.
- Las skills `plan-team` y `bond-team` saben trabajar en un hub: una fase o tarea es una rama
  vertical, se ponen al día las bases antes de abrirla y se recoge repo a repo. Al integrar
  recuerdan subir los punteros de los submódulos, sin hacerlo ellas.
- `bond team prompt` reintenta una vez un encargo que no llega a un agente recién arrancado
  (`agent_prompt_stalled`) y, si vuelve a fallar, da error en lugar de un aviso.
- La skill global `bond-team` vuelve a cargar en pi: su `description` no era YAML válido. Una
  prueba comprueba ahora el frontmatter de todas las skills globales.
- `bond` dentro de su propio workspace de Herdr abre el agente por defecto (o el de `--agent`) en
  el panel donde lo escribes, en la raíz del repo; al salir del agente vuelves a la shell. Antes
  solo decía que el workspace ya estaba abierto.
- La web (josecorral.dev/bond) estrena diseño y logo, y una página de **Novedades** / **What's
  new** con el modo hub y un vídeo en castellano y otro en inglés.

## 1.9.1

- `bond init` y el asistente de `bond setup` ya ofrecen Antigravity (`agy`) cuando su instalador
  lo deja en `~/.local/bin` y esa carpeta no está en el PATH, como ya hacían `bond doctor` y
  `bond team`. Antes no salía en la lista de agentes.

## 1.9.0

Antigravity (`agy`) entra en bond como un agente más, también en equipos, y aceptar decisiones
deja de pedirte una segunda validación: lo que apruebas en la conversación queda aceptado.

- Antigravity (`agy`) como agente del repo: `bond init --agents agy` y `bond sync` generan un
  plugin de bond en `.agents/plugins/bond/` con los servidores MCP (del catálogo y los de
  `[mcp_servers]`) y los comandos del catálogo y propios, cada uno como skill (`/commit`,
  `/review`...). `agy` ya leía `AGENTS.md` y `.agents/skills/` por su cuenta. Quitar `agy` de
  `agents` borra el plugin. `bond doctor` enseña la versión de `agy` y avisa si no está
  instalado o si está en `~/.local/bin` pero fuera del PATH.
- `bond setup` con `agy`: deja un plugin global, `bond-global`, en
  `~/.gemini/config/plugins/bond/` con tus instrucciones, las reglas de bond y las skills
  `bond-delegate`, `bond-team` y `herdr`, así que `agy` las carga en cualquier repo. Instala
  también la integración `antigravity-cli` de Herdr, y `bond doctor` comprueba las dos cosas. No
  toca nada más de `~/.gemini/config/`; sin `agy` entre tus agentes, no crea nada.
- `agy` en equipos y delegaciones (`bond team <rama>:agy`, skill `bond-delegate`):
  - arranca aunque solo esté en `~/.local/bin` (bond añade esa carpeta al PATH de la shell del
    panel) y con `--dangerously-skip-permissions`, porque sin él pide permiso por cada comando y
    no avanza; tus argumentos tras `--` lo sustituyen;
  - si `agy` pregunta si confías en la carpeta, la rama sale `bloqueado` y `prompt` no manda
    nada; el aviso de novedades al arrancar («esc to dismiss») ya no cuenta como pregunta;
  - `bond team collect` toma su respuesta de la conversación de `agy` (con la integración de
    Herdr) o, si no, del panel, sin el banner, el encargo repetido ni las líneas de herramientas.
- Confianza del orquestador en `bond team`: si el agente del panel que lanza el equipo (pi,
  Claude Code o `agy`) confía en el checkout principal, todos los agentes pi, Claude Code y `agy`
  del equipo arrancan confiando en su worktree, aunque su agente no hubiera abierto nunca el
  repo (en `agy`, en `trustedWorkspaces` de `~/.gemini/antigravity-cli/settings.json`). Sin esa
  confianza, cada agente hereda la que él mismo daba al checkout, como hasta ahora; `--no-trust`
  lo desactiva.
- Aceptar al aprobar: `bond decisions add` (y `record_decision` en pi) admite
  `--confirmed-by "<lo que dijo el usuario>"` (`confirmed_by` en el JSON) y registra la
  decisión ya `accepted`, con esa cita y `accepted_via`. Las skills `plan-create`,
  `decision-record`, `plan-execute` y `convention-document` lo usan: las decisiones que apruebas
  con un plan quedan aceptadas sin tener que aceptarlas otra vez; solo quedan `proposed` las que
  un agente toma por su cuenta.
- Sin cuadro de permiso para aceptar: `bond sync` ya no deja reglas `ask` para `bond decisions
  accept`, `reject` y `supersede` en `.claude/settings.json`, y quita las que dejó la 1.8.0
  conservando las tuyas. Si lo has pedido por chat, no hay que validar el comando otra vez.
- `bond team collect` con agentes Claude Code: toma el informe de su transcript
  (`~/.claude/projects/*/<sesión>.jsonl`) en vez del panel; cuenta como decisiones del agente
  solo las firmadas `agent:<kind>/<nombre>` que no estaban en la base (antes sumaba las del
  orquestador del mismo tipo y las ya existentes); y compara con la base guardada al mandar el
  encargo, así que recoger después de integrar la rama sigue mostrando sus commits y decisiones.
- `bond decisions check` mira solo los trailers `Decision:` de la rama actual: antes leía los de
  todas las ramas y, con agentes en paralelo, una rama fallaba por las decisiones de otra.

## 1.8.0

Aceptar decisiones sin salir de la conversación con tu agente: le dices cuáles aceptas y queda
constancia de que lo pediste tú y de quién lo ejecutó.

- `bond decisions accept`, `reject` y `supersede` admiten `--confirmed-by "<lo que dijo el
  usuario>"` y con él no necesitan terminal. La decisión guarda esa referencia en `accepted_by`
  y en `accepted_via` quién lo ejecutó (`agent:<kind>/<nombre>` desde un panel de Herdr, `user`
  fuera); `check` valida su formato. Aceptan varios ids y `--all-proposed`: un id desconocido o
  que no está `proposed` se informa sin cortar los demás, y la salida es distinta de 0 si alguno
  falla. Sin terminal y sin `--confirmed-by` se siguen negando, y un `--confirmed-by` vacío se
  rechaza.
- Comando nuevo del catálogo, `/accept`: enseña las decisiones `proposed`, te pregunta cuáles
  quieres y solo entonces las acepta, rechaza o sustituye citando tus palabras.
- En Claude Code, con `[decisions]`, `bond sync` añade a `.claude/settings.json` reglas `ask`
  para `accept`, `reject` y `supersede`: cada una pasa por el cuadro de permiso de Claude Code.
  Se fusionan con las reglas del repo sin pisarlas, y al quitar `[decisions]` solo se van las de
  bond.
- `bond decisions supersede` dejaba en `supersedes` de la decisión nueva su propio id en lugar
  del de la sustituida.
- El comentario de `[decisions]` que escribe `bond init` en `.bond/bond.toml` ya no habla de un
  índice en el README (desde la 1.7.0 no lo hay) y dice que los trailers `Agent:` y `Decision:`
  son opcionales.

## 1.7.0

Memoria de decisiones de los agentes: en un repo con bond, las decisiones, los encargos a otros
agentes y lo que respondieron quedan por escrito en el repo, para auditar después qué hizo cada
uno. La escritura la hace bond, no el modelo: funciona también con modelos locales que no
siguen formatos a mano.

- Se activa por repo con la sección `[decisions]` de `.bond/bond.toml` (`dir = "docs/decisions"`,
  ajustable dentro del repo). `bond init` la propone cuando eliges la skill `decision-record`,
  marcada por defecto; al reinicializar, una sección que ya tuvieras se conserva. `bond sync`
  crea `<dir>/README.md` con el formato si falta; después es del repo. Sin `[decisions]`, nada
  cambia.
- `bond decisions add` registra una decisión: el agente pasa el título, el contexto, la decisión
  y, si las hay, alternativas, consecuencias y enlaces (por flags o JSON con `--stdin`), y bond
  escribe `<dir>/<YYYY-MM-DD-slug>.md` con su frontmatter, la rama y el HEAD. La autoría la pone
  bond: en un panel de Herdr, el agente de ese panel (`agent:pi/kevin`); fuera, `user`. Siempre
  entra como `proposed`.
- `bond decisions accept`, `reject` y `supersede` son del usuario: piden terminal interactiva y
  confirmación, y se niegan desde el shell de un agente. Evita aceptaciones por descuido; no es
  una medida de seguridad (la integridad la da git).
- Para auditar: `bond decisions` lista (`--status`, `--agent`, `--json`), `show <id>` enseña una
  decisión o un run, `runs` lista los encargos y `check` valida frontmatter, ids, sustituciones y
  trailers `Decision:` (sale con 1 si hay errores). `bond doctor` añade una fila con los errores
  y las decisiones pendientes de aceptar.
- En pi, la herramienta `record_decision` (Bond Extensions) llama a `bond decisions add`.
- Encargos e informes: con la memoria activa, `bond team prompt` guarda el encargo exacto en
  `<dir>/runs/` antes de mandarlo (`--no-record` para no guardarlo; si falla al escribir, avisa
  y manda el prompt igual) y le pide al agente que commitee en su rama lo que registre. La nueva
  `bond team collect <rama>` guarda en el run la última respuesta del agente (de su fichero de
  sesión o, si no se puede, del panel sin el banner de arranque), el estado, los commits de la
  rama y las decisiones de ese agente; se niega mientras el agente trabaja o espera una respuesta
  y repetirlo no duplica nada. Con `--request` y `--agent` sirve también para delegaciones sin
  equipo.
- Las decisiones viajan con la rama y se revisan con el código; no hay un índice compartido que
  dé conflictos entre agentes en paralelo.
- Skills: `decision-record` es nueva; `plan-create`, `plan-execute`, `git-conventional-commit`,
  `delivery-review-github` y `convention-document` registran y enlazan sus decisiones con la
  herramienta; `bond-team`, `plan-team` y `bond-delegate` guardan encargos e informes con
  `prompt` y `collect`. Con la memoria activa, los commits pueden llevar los trailers opcionales
  `Agent:` y `Decision:`; sin ella, las skills no firman nada. Una regla global de `bond setup`
  pide usar la memoria en los repos que la tienen.
- `bond catalog check` falla si el frontmatter de una skill no es YAML válido (por ejemplo, una
  `description` sin comillas con `: ` dentro), que pi se niega a cargar aunque Claude Code lo
  tolere.

## 1.6.3

- `bond team status` da por `integrada` una rama que entró en la base por fast-forward o con un
  merge (antes salía `sin commits`, como si no hubiera empezado), y por eso `bond team clean`
  sin argumentos ya la quita. Lo distingue el reflog de la rama: si avanzó desde que se creó, ya
  trabajó. Una rama recién creada sigue saliendo `sin commits`.
- Nuevo vídeo en la web (https://josecorral.dev/bond/): Claude, solo en su panel, planifica una
  web, la reparte entre dos agentes pi con `bond team`, revisa, integra y limpia el equipo.

## 1.6.2

- La tool `repo_map` de pi (y el script `repo-map` de la skill `code-context`) ya no falla en
  repos con mucha historia: la lista de ficheros más tocados cortaba la tubería con `head` y,
  con `pipefail`, el script terminaba con error (SIGPIPE) aunque hubiera escrito el mapa.
- La web de la documentación (https://josecorral.dev/bond/) tiene vídeos de bond en acción sobre
  un proyecto real: `bond init`, el puesto de trabajo, un equipo de agentes y los catálogos.

## 1.6.1

- `bond init` interactivo vuelve a marcar de partida lo que el repo ya usa (o, en un repo nuevo,
  lo del catálogo por defecto). En la 1.6.0 la lista salía sin marcar y, si confirmabas sin
  tocarla, guardaba lo del catálogo de bond con prefijo (`"bond:context7"` en vez de
  `"context7"`): funcionaba, pero no era lo esperado. Un `bond.toml` con esos prefijos sigue
  valiendo; `bond init` lo deja otra vez con los nombres a secas.
- La documentación tiene web propia, en castellano e inglés: https://josecorral.dev/bond/
  (los mismos `docs/`, con buscador).

## 1.6.0

Catálogos del equipo: un equipo reúne en un repo sus skills, comandos y servidores MCP, y cada
proyecto lo usa con bond como usa el catálogo de bond.

- `bond catalog create`: prepara el repo actual como catálogo propio de un equipo. Pregunta el
  nombre (por defecto, el de la carpeta; `--name` para no preguntar) y crea `catalog.toml` y
  las carpetas `skills/`, `commands/` y `mcps/`, cada una con un `README.md` que explica cómo
  añadir lo suyo. No mete ejemplos instalables. Si ya hay `catalog.toml`, no lo toca y solo
  añade lo que falte.
- `bond catalog check [dir]`: comprueba un catálogo (skills con `SKILL.md` y `name` igual a su
  carpeta, comandos con `description`, servidores MCP con `command` o `url`, entradas de
  `catalog.toml` que existen) y sale con 1 si hay errores, para CI. Avisa de secretos escritos
  tal cual en `env` o `headers`.
- Catálogos del equipo en un repo: `[[catalog]]` con `path` en `.bond/bond.toml`. Sus skills,
  comandos y servidores MCP salen en `bond init` (y en `--list`, con el nombre del catálogo) y
  `bond sync` los genera para cada agente como los del catálogo de bond; en pi, sus comandos van
  a `.pi/prompts/`. Con el mismo nombre que una de bond, gana la del equipo (`bond:nombre` pide
  la de bond); en dos catálogos del equipo, se elige con `catalogo:nombre`. `sync`
  valida el catálogo como `bond catalog check` y no escribe nada si tiene errores; avisa si la
  carpeta está fuera del repo. Sin `[[catalog]]`, nada cambia.
- Catálogos del equipo por git: `bond catalog add <url> [--ref tag|rama|sha]` los declara en
  `.bond/bond.toml` (`[[catalog]]` con `name`, `git` y `ref`) y fija el commit en
  `.bond/lock.json`, que se commitea. `sync` usa ese commit (aunque la rama avance) y lo descarga
  a `~/.bond/catalogs/` si falta; con la caché llena funciona sin red. `bond catalog update`
  vuelve a resolver la ref y mueve el lock; `list`, `remove` (quita también lo elegido de él) y
  `clean` (poda la caché). `add` y `update` enseñan antes los servidores MCP que llegan o cambian
  y lo que pasa a venir de otro catálogo, y piden confirmación (`--yes`). `add` también acepta
  una carpeta (`[[catalog]] path`).
- `bond doctor` añade una fila por cada catálogo del equipo en `.bond/bond.toml`: el commit
  fijado en `.bond/lock.json`, si está descargado en `~/.bond/catalogs` y si la ref tiene un
  commit más nuevo (avisa con `bond catalog update <nombre>`; con `--quick` o sin acceso, «sin
  verificar» — no toca la red). Los catálogos locales salen con su carpeta, y falla si no
  existe.
- `bond doctor` ya no se corta cuando `.bond/bond.toml`, `.bond/lock.json` o un catálogo del
  equipo no valen (lock ilegible o que no cuadra, catálogo con errores, nombre desconocido): la
  fila «repo» falla con el motivo y el arreglo, y el resto de comprobaciones, incluida la fila
  de cada catálogo, sale igual.
- Skill nueva en el catálogo de bond: `catalog-maintain` (opcional, `default = false`). Ayuda a
  llenar y mantener un catálogo de equipo creado con `bond catalog create`: añadir skills,
  comandos y servidores MCP con el formato de los `README.md` que `create` deja en cada
  carpeta, mantener `catalog.toml` y pasar `bond catalog check` antes de publicar. No duplica
  la estructura que ya da `create`.
- Los servidores MCP del catálogo van ahora en un fichero por servidor (`catalog/mcps/<nombre>.json`
  en lugar de `catalog/mcp.json`), el mismo formato que los catálogos propios. Lo que genera
  `bond sync` no cambia.
- Documentado el ciclo de vida de los catálogos externos (crear, comprobar, publicar, añadir,
  sincronizar, actualizar y diagnosticar) con las notas de seguridad y de CI con repos privados
  en `docs/reference.md`; atajo para equipos en `docs/getting-started.md`.

## 1.5.1

- `bond doctor`: ejecutándose desde el repo de bond, si `~/.bond/pi` apunta a un runtime
  instalado (`~/.bond/runtime/<versión>` con su marca `.complete`) la fila «Bond Extensions»
  avisa en vez de fallar: pi está usando las extensiones de esa versión instalada y no las
  del repo en desarrollo. Sigue fallando si el destino no es ni el repo ni un runtime válido.

## 1.5.0

- `bond setup` instala y configura las sugerencias de prompt de pi: al terminar cada turno, con
  el editor vacío, pi muestra en *ghost text* el siguiente prompt sugerido, aceptable con `→` o
  `Tab`. Bond hace `pi install npm:@mrclrchtr/supi-prompt-suggestions@11.0.1` en el ámbito
  personal (no por proyecto), elige el modelo entre los de coste cero del registro de bond y pone
  `enabledModels: ["*"]` en pi si no lo tenía ya. El config de la suite supi se fusiona: las
  secciones de otros paquetes se conservan. `--no-suggestions` las deja apagadas.
- `[suggestions]` en `~/.bond/config.toml`: `enabled` y `model` (p. ej.
  `model = "halo/flash-halogen"`). Sin sección, bond aplica su heurística y, si el registro no
  tiene ningún modelo para pi, propone apagado.
- `bond doctor` añade la fila «sugerencias»: modelo, si el paquete está instalado,
  `enabledModels` y si el config de la extensión coincide con `config.toml`; avisa además de
  otras extensiones locales que reemplacen el editor (solo una puede estar activa). Nunca falla:
  es una comodidad, no una pieza de la instalación.

## 1.4.0

- Al abrir el puesto de trabajo (`bond`, `bond dev`, `bond team`), bond mira una vez al día si
  hay release nueva (tope de ~2 s; sin red, sigue sin más) y pregunta: 1) actualizar ahora,
  2) omitir esa versión hasta que salga otra o 3) no volver a preguntar (`[update] auto =
  false` en `~/.bond/config.toml`). Con «1» y el binario de `install.sh`/`install.ps1`,
  descarga, comprueba el SHA-256 y que arranca, sustituye el binario y sigue con la versión
  nueva; con Homebrew, npm o desde el código dice el comando. Sin terminal solo avisa.
  `BOND_NO_UPDATE=1` lo desactiva.
- Con «1» en una instalación de Homebrew, bond avisa de que `brew update` refresca todos los
  taps y corre `brew update && brew upgrade jmanuelcorral/tap/bond` con la salida de brew a la
  vista; si brew falla, se ve su error y sigues con la versión que tenías.
- En una instalación por npm, bond ya no propone `npm i -g @jmanuelcorral/bond@latest`: el
  paquete aún no está publicado en npm, así que remite al `.tgz` de la release.
- `bond update --skip vX.Y.Z` omite esa versión en el aviso de arranque (hasta que salga otra),
  sin tocar la red; `bond update --skip-reset` quita la omisión.
- `bond doctor` añade la fila «actualizaciones»: método de instalación, última comprobación,
  versión pendiente, versión omitida y si se pregunta al arrancar. Solo avisa si hay una versión
  pendiente sin omitir; no haber mirado nunca no cuenta como fallo.

## 1.3.0

- Quitado el pie `Prepared with bond skills` de las skills del catálogo: los agentes ya no cierran
  sus respuestas con esa marca. Se mantiene la prohibición de atribuirse a bond como agente o de
  meter branding en ficheros del proyecto sin aprobación.

- `bond` abre solo el agente, sin la shell de al lado; `bond --shell` la recupera (`-d` y `-r`
  ahora se aplican a ella). El agente del checkout principal se llama `gru` (`gru-2`... si ya
  hay otro en Herdr), en vez de `<agente>-<repo>`.
- `bond team` dentro de Herdr abre cada agente en un panel de tu pestaña, debajo del tuyo (en
  fila, hasta 4), con nombre de minion (`kevin`, `stuart`, `bob`...) y el panel titulado
  `minion · rama`, en vez de un workspace por rama. `--workspaces` mantiene el modo anterior,
  que sigue siendo el de fuera de Herdr. `bond team status` enseña el panel de cada agente y
  `bond team clean` lo cierra al quitar su worktree.
- `bond team` en paneles: si confías en el checkout principal en pi (`~/.pi/agent/trust.json`)
  o en Claude Code (`~/.claude.json`), cada worktree hereda esa confianza y su agente arranca
  sin preguntar. Sin ella, o con otros agentes, pregunta como antes; `--no-trust` lo desactiva.
- `bond team status --watch`: tabla en vivo, refrescada cada 2 s, con el minion, la rama, el
  estado, los commits y los ficheros de cada agente; sale con `q` o Ctrl+C. `bond team` dentro de Herdr la abre en un panel estrecho a la derecha del
  tuyo (`tabla · <repo>`), o reutiliza el que ya hay.
- `bond team` en paneles: tu pestaña admite 6 paneles (el tuyo, la tabla y 4 minions). Si los
  agentes no caben, pregunta antes de crear nada: 1) pestañas nuevas `equipo · <repo>`, 4 por
  pestaña (por defecto), 2) todo en tu pestaña, en filas de 4, o 3) un workspace por rama.
  `--tabs`, `--same-tab` y `--workspaces` eligen sin preguntar; sin terminal o con `--yes`,
  la 1. La tabla en vivo se abre también con `--workspaces` y muestra todas las ramas.
- `bond team clean`: si al acabar no queda ningún agente del equipo, cierra también el panel de
  la tabla en vivo (`--keep-table` lo deja). `bond team status --watch`, en su panel, cuando
  ninguna rama tiene trabajo pendiente avisa `sin trabajo pendiente` y cierra el panel; no si
  está enfocado ni con `--keep-open`.
- `bond team status --watch` agrupa las ramas por estado, primero lo que te espera: ⛔ necesita
  tu respuesta (con la pregunta debajo), 🔄 trabajando, ✏️ sin commitear, 📦 por revisar y
  ✅ integradas / sin empezar; los grupos vacíos no salen. El icono del estado va solo en el
  título del grupo, en su color; sin columna con la última línea del panel del agente.
- Skill `plan-team` en el catálogo (opcional): ejecuta en paralelo las fases independientes de
  un plan de `docs/plans/`, una rama, worktree y agente por fase con `bond team`. Cada agente
  implementa solo su fase con `plan-execute` y hace commit en su rama si la verificación pasa,
  sin push; al integrar cada rama, actualiza el plan. Antes de crear el equipo anuncia dónde
  se abre cada agente y cuáles arrancan con la confianza heredada, y remite a la tabla en vivo
  para seguirlo. Al confirmar que una rama está integrada, cierra su panel con
  `bond team clean <rama>` (la rama se queda), y al terminar el plan tu pestaña queda sin
  paneles del equipo. `plan-create` y `bond-team` la ofrecen cuando toca.

## 1.2.1

- `bond init`: antes de elegir herramientas enseña qué hace cada una (servidores MCP, skills y
  comandos), con las opcionales señaladas. Antes la explicación solo salía en las marcadas y en
  la del cursor. Las skills salen en el orden de `catalog/catalog.toml`.

## 1.2.0

- Catálogo: skills para llevar una tarea de la issue a la release, adaptadas de
  [fluzo-labs/common-skills](https://github.com/fluzo-labs/common-skills) (MIT), solo en modo
  guiado: `git-conventional-commit` (la usa `/commit`), `plan-create` (planes en `docs/plans/`;
  las fases independientes, en paralelo con `bond team`) y `plan-execute`. Opcionales:
  `issue-refine-github`, `delivery-review-github` (tras el merge sugiere `bond team clean`),
  `release-prepare-github` (si un workflow publica al empujar el tag, ese push es la
  publicación) y `convention-document`.
- `/commit` usa `git-conventional-commit` si el repo la tiene; si no, la forma de commitear del
  agente.
- `bond init`: las skills opcionales salen sin marcar y `--yes` instala solo las de por defecto.
- `bond team status`: por rama, estado (trabajando, bloqueado, sin commitear, lista, integrada,
  sin commits), agente, commits por delante de la base y ficheros. Reconoce las ramas
  integradas por fast-forward, rebase o squash.
- `bond team prompt <rama> "tarea"`: manda trabajo al agente de una rama sin saber su nombre.
- `bond team clean`: quita los worktrees de las ramas integradas (o los que nombres), con su
  workspace, su agente y la carpeta vacía de Herdr; las ramas se quedan salvo con
  `--delete-branch`. Nunca uno con el agente trabajando o esperando, o con cambios sin
  commitear, salvo con `--force`.
- pi en un worktree nuevo pregunta si confía en la carpeta y Herdr lo da por libre: el primer
  prompt contestaba "Trust" por ti y la tarea se perdía. Ahora bond lee el panel: la rama sale
  `bloqueado` (también en `bond`) y `bond team prompt` no manda nada hasta que contestes tú.
- El skill `bond-team` usa `bond team status` y `bond team prompt`.

## 1.1.0

- `bond update`: pone bond al día con la última release (o `--version vX.Y.Z`). Con el binario
  de los instaladores lo descarga, comprueba su SHA-256, prueba que arranca y lo sustituye; con
  Homebrew o npm dice el comando. `--check` solo mira.
- `~/.bond/runtime/` ya no crece con cada versión: la que arranca pasa a sus ficheros
  `~/.bond/pi` y los skills globales y borra las versiones viejas.
- `bond team`: usa el agente por defecto del repo (`bond.toml`) en vez del global; el repo es
  opcional (`bond team feat/a feat/b:claude`); avisa de agentes sin config en el repo y de
  cambios sin commitear; valida los nombres de rama antes de tocar Herdr.
- Windows: bond encuentra los agentes instalados (`claude.cmd`, `codex.exe`...): `which` prueba
  las extensiones de `PATHEXT`. Antes `bond init`, `bond` y `bond setup` no veían ninguno.
- Windows: `bond setup` copia los skills globales en vez de enlazarlos (los symlinks piden
  permisos especiales); `bond doctor` reconoce esas copias.
- Windows: `.bond/manifest.json` guarda las rutas con `/`, como en Linux y macOS (antes, con
  `\`, un repo sincronizado en otro sistema veía como ajenos los ficheros de bond). Se entienden
  los registros antiguos. `bond sync` ya quita las carpetas que deja vacías.
- Los errores de Herdr sin mensaje ya no salen vacíos.
- Pruebas (`bun test`) de `bond init`/`sync` y comprobación de tipos (`tsc`) en CI, en las tres
  plataformas.

## 1.0.1

- Licencia MIT (`LICENSE`), declarada en npm, Homebrew y AUR.

## 1.0.0

Primera versión instalable sin clonar el repo:

- Binarios autocontenidos para Linux (x64, arm64), macOS (Intel, Apple silicon) y Windows (x64)
  en cada release de GitHub, con `SHA256SUMS`.
- Instaladores: `curl -fsSL https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.sh | sh`
  y, en Windows, `irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex`.
- Homebrew: `brew install jmanuelcorral/tap/bond`.
- `bond init --agents` puede preparar la config de agentes que no están instalados en la máquina.

## 0.11.0

- Migración a la 1.0: la config de pi ya no se enlaza desde el repo de bond. `bond migrate` (y
  `bond setup`, que la ejecuta) convierte los enlaces de una instalación anterior en ficheros
  propios con copia `.bak`, pasa tus instrucciones a `~/.bond/AGENTS.md` y quita el paquete
  global de pi: las Bond Extensions se cargan por repo.
- Se quitan `install.sh`, `pi/agent/` y el filtro de git de `settings.json`.

## 0.10.0

- `bond` a secas dentro de un repo abre su puesto de trabajo en Herdr con el agente por
  defecto: arranca el servidor si hace falta, ofrece `bond init` si el repo no tiene bond y
  regenera su config si está desfasada. `--agent`, `--worktree`, `--no-focus`, `--no-attach`.
- `bond dev`, `bond team`, `bond status` y `bond sessions` pasan a TypeScript (funcionan en
  Windows); se quitan los scripts bash `pidev`, `piteam`, `pistatus` y `pisessions`.
- Etiquetas de workspace `bond:<repo>` (se reconocen las antiguas `pi:<repo>`).

## 0.9.0

- `bond init` interactivo: agentes del repo, agente por defecto y herramientas del catálogo; en
  un repo ya inicializado cambia solo la selección. Bond Extensions de pi por repo vía
  `~/.bond/pi`.

## 0.8.0

- `bond setup` interactivo: Herdr, endpoints (detecta Ollama y LM Studio; OpenAI y compatibles),
  agentes elegidos y por defecto, instrucciones personales en cada agente. Config en `~/.bond/`,
  claves en `~/.bond/keys/` (600).
- bond se compila como binario autocontenido (Linux, macOS, Windows) y paquete de npm.

## 0.7.0

- El proyecto pasa a llamarse **bond** y se publica en GitHub.
- El paquete de pi se enlaza como `~/.pi/agent/bond`; `bond setup` quita el enlace antiguo
  `~/.pi/agent/pisetup`. La marca del bloque de Herdr es `>>> bond >>>` (la antigua
  `>>> piSetup >>>` se sigue reconociendo).
- `bond setup` sustituye los enlaces rotos (p. ej. tras mover el repo) sin dejar copias `.bak`.

## 0.6.0

- Skills globales `bond-delegate` y `bond-team`: cualquier agente delega en cualquier otro
  (`rol:kind`, `rama:kind`). En pi, `/delegate` y `/team` son atajos a ellos.
- `bond setup` instala la integración de Herdr de cada agente instalado.
- El servidor MCP de búsqueda pasa de `web` a `duckduckgo` (OpenAI reserva `web`); `web` sigue
  valiendo como alias en `bond.toml`.

## 0.5.0

- `bond init` y `bond sync` generan también la configuración de Copilot CLI, Codex, opencode,
  Crush y Gemini CLI.

## 0.4.0

- `bond init` y `bond sync`: configuración por repo (`.bond/bond.toml`) para pi y Claude Code,
  con registro de lo generado para no pisar ediciones a mano.
- Catálogo (`catalog/`): servidores MCP, skill `code-context`, comandos `review`, `commit`,
  `handoff`.

## 0.3.0

- Registro global de modelos (`~/.config/bond/config.toml`): `bond models init|list|probe|sync`
  para pi, opencode, Crush y Codex, y `bond run copilot`.

## 0.2.0

- CLI `bond`: `setup` (antes `install.sh`), `doctor`, `dev`, `team`, `status`, `sessions`, `logo`.

## 0.1.0

- Setup de pi y Herdr como paquete de pi: pie de estado, cabecera BOND, `repo_map`, MCP de
  documentación y búsqueda web, skill `code-context`, `pidev`, `piteam`, `/delegate`, `/team`.
