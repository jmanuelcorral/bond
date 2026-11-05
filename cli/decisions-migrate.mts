// `bond decisions migrate`: migra las decisiones `accepted` históricas
// con `accepted_via` no vacío a `accepted_via: "user"` según la semántica B1 de #82.
// Idempotente y con soporte de `--dry-run` y `--json`.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseFm } from "./decisions.mts";
import { t } from "./messages.mts";
import { dim, ok } from "./util.mts";

export type MigrationAction = "migrated" | "already_user" | "empty" | "skipped";

export interface MigrationFileItem {
	file: string;
	status: string;
	action: MigrationAction;
	from?: string;
	to?: string;
	reason?: string;
}

export interface MigrationReport {
	dryRun: boolean;
	total: number;
	migratedCount: number;
	alreadyUserCount: number;
	emptyCount: number;
	skippedCount: number;
	items: MigrationFileItem[];
	migrated: MigrationFileItem[];
}

/**
 * Modifica la clave `accepted_via` en el frontmatter conservando byte a byte el resto
 * del frontmatter y el cuerpo del fichero, así como las terminaciones de línea (CRLF o LF).
 */
export function rewriteAcceptedVia(raw: string, newVia: string): string {
	const isCrlf = raw.includes("\r\n");
	const eol = isCrlf ? "\r\n" : "\n";
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return raw;
	const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
	if (end < 0) return raw;

	let replaced = false;
	for (let i = 1; i < end; i++) {
		const m = /^([ \t]*accepted_via:[ \t]*)(.*)$/.exec(lines[i]);
		if (m) {
			lines[i] = `${m[1]}"${newVia}"`;
			replaced = true;
			break;
		}
	}
	if (!replaced) {
		lines.splice(end, 0, `accepted_via: "${newVia}"`);
	}
	return lines.join(eol);
}

/**
 * Recorre las decisiones en `dirRel`, analiza su frontmatter con `parseFm` de `cli/decisions.mts`,
 * y para cada decisión con `status: accepted` y `accepted_via` no vacío, la migra a `accepted_via: "user"`.
 *
 * - Las decisiones que ya tengan `accepted_via: "user"` se dejan intactas.
 * - Las que tengan `accepted_via` vacío se dejan vacías (decisiones aceptadas en terminal, D20).
 * - Las que no tengan `status: accepted` (proposed, rejected, superseded) no se tocan.
 * - Con `dryRun: true` no escribe en disco.
 * - Es idempotente: una segunda ejecución no produce cambios.
 */
export function migrateAcceptedVia(
	root: string,
	dirRel: string,
	opts?: { dryRun?: boolean },
): MigrationReport {
	const dryRun = !!opts?.dryRun;
	const dir = join(root, ...dirRel.split("/"));
	const files = existsSync(dir)
		? readdirSync(dir)
				.filter((f) => f.endsWith(".md") && f !== "README.md")
				.sort()
		: [];

	const items: MigrationFileItem[] = [];
	let migratedCount = 0;
	let alreadyUserCount = 0;
	let emptyCount = 0;
	let skippedCount = 0;

	for (const f of files) {
		const rel = `${dirRel}/${f}`;
		const absPath = join(dir, f);
		const raw = readFileSync(absPath, "utf8");
		const p = parseFm(raw);
		if (!p) {
			skippedCount++;
			items.push({ file: rel, status: "", action: "skipped", reason: "invalid_fm" });
			continue;
		}

		const status = p.scalars.status ?? "";
		if (status !== "accepted") {
			skippedCount++;
			items.push({ file: rel, status, action: "skipped", reason: "not_accepted" });
			continue;
		}

		const via = p.scalars.accepted_via ?? "";
		if (via === "") {
			emptyCount++;
			items.push({ file: rel, status, action: "empty" });
			continue;
		}

		if (via === "user") {
			alreadyUserCount++;
			items.push({ file: rel, status, action: "already_user" });
			continue;
		}

		migratedCount++;
		items.push({
			file: rel,
			status,
			action: "migrated",
			from: via,
			to: "user",
		});

		if (!dryRun) {
			const updated = rewriteAcceptedVia(raw, "user");
			writeFileSync(absPath, updated, "utf8");
		}
	}

	const migrated = items.filter((it) => it.action === "migrated");

	return {
		dryRun,
		total: files.length,
		migratedCount,
		alreadyUserCount,
		emptyCount,
		skippedCount,
		items,
		migrated,
	};
}

/** Formatea el resultado de la migración para salida por terminal. */
export function formatMigrateOutput(report: MigrationReport, dirRel: string): string {
	const lines: string[] = [];
	if (!report.migratedCount && !report.alreadyUserCount && !report.emptyCount) {
		return dim(t("decisions.migrate_nothing", { dir: dirRel }));
	}

	if (report.dryRun) {
		lines.push(t("decisions.migrate_dry_run_header"));
		for (const item of report.migrated) {
			lines.push(`  ${ok("~")} ${item.file}  ${dim(`(${item.from} -> ${item.to})`)}`);
		}
		lines.push(
			t("decisions.migrate_dry_run_summary", {
				count: report.migratedCount,
				total: report.total,
				already: report.alreadyUserCount,
				empty: report.emptyCount,
				skipped: report.skippedCount,
			}),
		);
	} else {
		lines.push(t("decisions.migrate_applied_header"));
		for (const item of report.migrated) {
			lines.push(`  ${ok("~")} ${item.file}  ${dim(`${item.from} -> ${item.to}`)}`);
		}
		lines.push(
			t("decisions.migrate_applied_summary", {
				migrated: report.migratedCount,
				already: report.alreadyUserCount,
				empty: report.emptyCount,
				skipped: report.skippedCount,
			}),
		);
	}

	lines.push("");
	lines.push(dim(t("decisions.migrate_disclaimer")));
	return lines.join("\n");
}

/** Ejecuta el comando `bond decisions migrate`. */
export function runMigrate(
	root: string,
	dirRel: string,
	opts: { dryRun: boolean; json: boolean },
): void {
	const report = migrateAcceptedVia(root, dirRel, { dryRun: opts.dryRun });
	if (opts.json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	console.log(formatMigrateOutput(report, dirRel));
}
