/**
 * Textos de la consola de bond del área de migración de accepted_via en decisiones.
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla.
 */

export const es = {
	"decisions.migrate_dry_run_header": "Simulación de migración de accepted_via (--dry-run):",
	"decisions.migrate_dry_run_summary": "Tocaría migrar {count} de {total} decisión(es) ({already} ya en \"user\", {empty} vacía(s), {skipped} omitida(s))",
	"decisions.migrate_applied_header": "Migración de accepted_via:",
	"decisions.migrate_applied_summary": "{migrated} migrada(s) a \"user\", {already} ya estaban como \"user\", {empty} vacía(s) (aceptadas en terminal), {skipped} omitida(s)",
	"decisions.migrate_nothing": "Nada que migrar: no hay decisiones pendientes en {dir}/",
	"decisions.migrate_disclaimer": "Aviso: la migración asume que cada accepted_by fue palabra del usuario (no es verificable desde el frontmatter). Las correcciones individuales quedan en el historial de git y en las notas de trazabilidad.",
	"decisions.migrate_item_migrated": "{file}  {from} -> {to}",
	"decisions.migrate_item_would_migrate": "{file}  (pasaría de {from} a {to})",
} as const;

export const en: Record<keyof typeof es, string> = {
	"decisions.migrate_dry_run_header": "Simulation of accepted_via migration (--dry-run):",
	"decisions.migrate_dry_run_summary": "Would migrate {count} of {total} decision(s) ({already} already \"user\", {empty} empty, {skipped} skipped)",
	"decisions.migrate_applied_header": "Migration of accepted_via:",
	"decisions.migrate_applied_summary": "{migrated} migrated to \"user\", {already} already set to \"user\", {empty} empty (accepted in terminal), {skipped} skipped",
	"decisions.migrate_nothing": "Nothing to migrate: no decisions pending migration in {dir}/",
	"decisions.migrate_disclaimer": "Notice: the migration assumes that each accepted_by was the user's actual words (this cannot be verified from the frontmatter). Individual corrections remain in git history and traceability notes.",
	"decisions.migrate_item_migrated": "{file}  {from} -> {to}",
	"decisions.migrate_item_would_migrate": "{file}  (would change from {from} to {to})",
};
