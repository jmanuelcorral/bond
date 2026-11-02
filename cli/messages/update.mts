/**
 * Textos de la consola de bond del área comando update.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"update.help": `Uso: bond update [opciones]

Pone bond al día con la última release de GitHub. Si lo instalaste con install.sh o
install.ps1, descarga el binario, comprueba su SHA-256 y sustituye el actual; con Homebrew
te dice el comando. El paquete aún no está publicado en npm: con npm te remite al .tgz de la
release. La versión nueva quita los ficheros de las anteriores (~/.bond/runtime) tras
reenlazar lo que los usaba.

  --check              Solo dice si hay una versión nueva
  --version <vX.Y.Z>   Instala esa versión (también para volver a una anterior)
  --force              Reinstala aunque ya tengas esa versión
  --dry-run            Dice qué haría sin descargar nada
  --skip <vX.Y.Z>      No avisar de esa versión al arrancar (hasta que salga otra)
  --skip-reset         Vuelve a avisar de la versión omitida

Al abrir el puesto de trabajo (bond, bond dev, bond team), bond mira una vez al día si hay
release nueva (como mucho ~2 s; sin red, sigue sin más) y pregunta: 1) actualizar ahora,
2) omitir esa versión hasta que salga otra, 3) no volver a preguntar ([update] auto = false
en ~/.bond/config.toml). Con «1» y Homebrew corre brew update && brew upgrade
jmanuelcorral/tap/bond a la vista (brew update refresca todos tus taps); si brew falla, sigues
con la versión que tenías. Sin terminal solo avisa. BOND_NO_UPDATE=1 lo desactiva.`,
	"update.err_not_found": "no encuentro la última release en {base} (HTTP {status})",
	"update.err_no_binary": "no hay binario de bond para {platform}-{arch}",
	"update.err_download_failed": "no pude descargar {url} (HTTP {status})",
	"update.err_missing_sha": "{asset} no aparece en SHA256SUMS de {tag}",
	"update.err_sha_mismatch": "la suma SHA-256 no coincide: descarga corrupta o alterada",
	"update.manual_source": "Desde el código: git -C {dir} pull && npm ci --ignore-scripts",
	"update.manual_brew": "Con Homebrew: brew update && brew upgrade {formula}",
	"update.manual_npm": "Con npm: @jmanuelcorral/bond aún no está publicado en npm. Instala el paquete de la release: npm i -g {url}",
	"update.err_not_writable": "no puedo escribir en {dir}: actualiza con el mismo método con el que instalaste bond",
	"update.downloading": "Descargando {asset} ({tag})",
	"update.err_binary_start": "el binario descargado no arranca bien: {detail}",
	"update.err_replace": "no pude sustituir {exe}: {error}",
	"update.installed_binary": "bond {version} instalado en {exe}",
	"update.warn_no_cleanup": "bond {version} no limpia ~/.bond/runtime: no pasa nada, ocupan sitio",
	"update.brew_note": "brew update refresca el índice de todos los taps de esta máquina, no solo el de bond (bond no puede deshacerlo)",
	"update.err_brew_failed": "falló {cmd}{detail}",
	"update.err_brew_stale": "Homebrew no trae la {version} ({exe} da {got}): el tap puede ir por detrás de la release",
	"update.nothing": "nada",
	"update.installed_brew": "bond {version} instalado con Homebrew en {exe}",
	"update.opt_version_val": "--version necesita un valor (p. ej. v1.0.2)",
	"update.opt_skip_val": "--skip necesita una versión (p. ej. v1.4.0)",
	"update.unknown_opt": "opción desconocida: {opt} (bond update --help)",
	"update.err_skip_conflict": "--skip y --skip-reset no van juntas",
	"update.err_skip_with_other": "{flag} no va con --check, --version ni --force",
	"update.already_that": "bond {version} ya es esa versión",
	"update.already_latest": "bond {version} ya es la última",
	"update.newer_than_latest": "bond {version} es más nuevo que la última release ({tag})",
	"update.dry_run_binary": "  [dry-run] descargaría {asset} de {tag}, comprobaría su SHA-256 y sustituiría {exe}",
	"update.ready": "listo",
	"update.no_skipped": "no había ninguna versión omitida",
	"update.dry_run_skip_reset": "  [dry-run] quitaría la omisión de la {version}",
	"update.skip_reset_done": "vuelvo a avisar de la {version}",
	"update.err_skip_format": "--skip espera una versión vX.Y.Z (no {version})",
	"update.dry_run_skip": "  [dry-run] omitiría la {version} en {file}",
	"update.skip_set": "no avisaré de la {version} al arrancar; sí de la siguiente (bond update --skip-reset lo quita)",
	"update.already_have": "  Ya tienes {version}: esa versión no se ofrecería de todos modos.",
	"update.offer_available": "{latest} disponible (tienes {current}): bond update",
	"update.offer_prompt_header": "Hay una versión nueva de bond: {current} → {latest}",
	"update.offer_opt_1": "  1) Actualizar ahora",
	"update.offer_opt_2": "  2) Omitir la {version} (avisaré de la siguiente)",
	"update.offer_opt_3": "  3) No volver a preguntar",
	"update.offer_ask": "Elige [Intro: ahora no]: ",
	"update.offer_skip_ack": "  No volveré a nombrar la {version}.",
	"update.offer_never_ack": "  No volveré a preguntar ([update] auto = false en ~/.bond/config.toml). bond update sigue a mano.",
	"update.warn_not_updated": "no he actualizado: {error}. Sigues con bond {version}.",
} as const;

export const en: Record<keyof typeof es, string> = {
	"update.help": `Usage: bond update [options]

Updates bond to the latest GitHub release. If you installed it with install.sh or
install.ps1, it downloads the binary, verifies its SHA-256 and replaces the current
one; with Homebrew it tells you the command. The package is not yet published on npm:
with npm it points you to the release .tgz. The new version removes files from previous
ones (~/.bond/runtime) after relinking whatever was using them.

  --check              Only check if there is a new version
  --version <vX.Y.Z>   Install that version (also to revert to a previous one)
  --force              Reinstall even if you already have that version
  --dry-run            Show what it would do without downloading anything
  --skip <vX.Y.Z>      Do not notify about this version on startup (until another appears)
  --skip-reset         Resume notifying about the skipped version

When opening the workstation (bond, bond dev, bond team), bond checks once a day if
there is a new release (at most ~2 s; without network, it simply continues) and asks:
1) update now, 2) skip this version until another appears, 3) do not ask again
([update] auto = false in ~/.bond/config.toml). With "1" and Homebrew it runs brew
update && brew upgrade jmanuelcorral/tap/bond in view (brew update refreshes all your
taps); if brew fails, you stay with the version you had. Without a terminal it only
warns. BOND_NO_UPDATE=1 disables it.`,
	"update.err_not_found": "cannot find latest release at {base} (HTTP {status})",
	"update.err_no_binary": "no bond binary for {platform}-{arch}",
	"update.err_download_failed": "could not download {url} (HTTP {status})",
	"update.err_missing_sha": "{asset} does not appear in SHA256SUMS of {tag}",
	"update.err_sha_mismatch": "SHA-256 checksum mismatch: corrupted or altered download",
	"update.manual_source": "From source: git -C {dir} pull && npm ci --ignore-scripts",
	"update.manual_brew": "With Homebrew: brew update && brew upgrade {formula}",
	"update.manual_npm": "With npm: @jmanuelcorral/bond is not yet published on npm. Install the release package: npm i -g {url}",
	"update.err_not_writable": "cannot write to {dir}: update using the same method used to install bond",
	"update.downloading": "Downloading {asset} ({tag})",
	"update.err_binary_start": "the downloaded binary does not start properly: {detail}",
	"update.err_replace": "could not replace {exe}: {error}",
	"update.installed_binary": "bond {version} installed in {exe}",
	"update.warn_no_cleanup": "bond {version} does not clean ~/.bond/runtime: harmless, but uses space",
	"update.brew_note": "brew update refreshes the index of all taps on this machine, not just bond (bond cannot undo it)",
	"update.err_brew_failed": "failed: {cmd}{detail}",
	"update.err_brew_stale": "Homebrew does not provide {version} ({exe} gives {got}): the tap may lag behind the release",
	"update.nothing": "nothing",
	"update.installed_brew": "bond {version} installed with Homebrew in {exe}",
	"update.opt_version_val": "--version requires a value (e.g. v1.0.2)",
	"update.opt_skip_val": "--skip requires a version (e.g. v1.4.0)",
	"update.unknown_opt": "unknown option: {opt} (bond update --help)",
	"update.err_skip_conflict": "--skip and --skip-reset cannot be used together",
	"update.err_skip_with_other": "{flag} cannot be used with --check, --version or --force",
	"update.already_that": "bond {version} is already that version",
	"update.already_latest": "bond {version} is already the latest",
	"update.newer_than_latest": "bond {version} is newer than the latest release ({tag})",
	"update.dry_run_binary": "  [dry-run] would download {asset} from {tag}, verify its SHA-256, and replace {exe}",
	"update.ready": "done",
	"update.no_skipped": "no version was skipped",
	"update.dry_run_skip_reset": "  [dry-run] would remove the skip for {version}",
	"update.skip_reset_done": "resuming notifications for {version}",
	"update.err_skip_format": "--skip expects a version vX.Y.Z (not {version})",
	"update.dry_run_skip": "  [dry-run] would skip {version} in {file}",
	"update.skip_set": "will not notify about {version} on startup; will notify about the next (bond update --skip-reset clears this)",
	"update.already_have": "  You already have {version}: that version would not be offered anyway.",
	"update.offer_available": "{latest} available (you have {current}): bond update",
	"update.offer_prompt_header": "There is a new version of bond: {current} → {latest}",
	"update.offer_opt_1": "  1) Update now",
	"update.offer_opt_2": "  2) Skip {version} (will notify on the next)",
	"update.offer_opt_3": "  3) Do not ask again",
	"update.offer_ask": "Choose [Enter: not now]: ",
	"update.offer_skip_ack": "  Will not mention {version} again.",
	"update.offer_never_ack": "  Will not ask again ([update] auto = false in ~/.bond/config.toml). bond update is still manual.",
	"update.warn_not_updated": "update failed: {error}. Remaining on bond {version}.",
};
