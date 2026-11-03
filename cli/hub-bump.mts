// bond hub bump: lleva el puntero (gitlink) que el hub guarda de cada repo de la sesión enlazado
// como submódulo al commit actual de su rama base y lo commitea en la rama actual del hub.
// Nunca hace push: el commit queda local para que el usuario lo revise y lo empuje (issue #43).
//
// Se apoya en `bond hub pull` (b3a740e, c23f375), que es quien avanza las refs de base
// (incluso desincronizadas, con HEAD separado) desde el remoto: bump consume el estado local de
// esas refs y no repite esa maquinaria. El flujo es `bond hub pull` y después `bond hub bump`.
//
// Por repo: al día si el puntero ya apunta a la base; saltado y explicado si el submódulo no está
// en disco, no figura como submódulo en el índice, su base no se resuelve, está sucio o su HEAD no
// coincide ni con el puntero del hub ni con su base (desincronizado). Los repos enlazados por
// symlink se listan como «no aplica»: no hay gitlink que mover. Con --dry-run y --json.

import { currentBranch, dieNotAHub, hubRepoLabel, hubRoot, hubSession, type HubRepo, type HubSession } from "./hub.mts";
import { bad, caution, die, dim, isDryRun, log, ok, run, setDryRun, warn } from "./util.mts";
import { t } from "./messages.mts";

export const hubBumpHelp = (): string => t("hub.bump.help");

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
const firstLine = (s: string) => s.trim().split("\n")[0] ?? "";

export type BumpStatus = "moved" | "up_to_date" | "skipped" | "not_applicable" | "failed";

export interface RepoBumpResult {
	repo: string;
	path: string;
	base: string;
	link: "submodule" | "symlink";
	status: BumpStatus;
	/** Commit del puntero actual (corto), solo si había gitlink. */
	from?: string;
	/** Commit de la base (corto) al que se mueve o se movería. */
	to?: string;
	detail?: string;
	reason?: string;
}

export interface HubBumpReport {
	hub: string;
	root: string;
	dryRun?: boolean;
	ok: boolean;
	/** SHA corto del commit creado en el hub (undefined si no hubo nada que commitear o en --dry-run). */
	commit?: string;
	repos: RepoBumpResult[];
}

export interface BumpOpts {
	dryRun?: boolean;
}

/** SHA corto resolviendo en `dir` (los objetos del submódulo no están en el hub); fallback los 7 primeros. */
const shortSha = (dir: string, sha: string) => {
	const r = git(dir, ["rev-parse", "--short", sha]);
	return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : sha.slice(0, 7);
};

/** Decisión de bump de un repo de la sesión, solo con lecturas: sin target si no hay que mover nada. */
interface BumpDecision {
	res: RepoBumpResult;
	/** Commit completo de la base al que hay que mover el gitlink (solo si procede). */
	target?: string;
	/** El submódulo estaba en HEAD separado: tras el commit se le actualiza el checkout. */
	checkoutDetached?: boolean;
}

function decideBump(r: HubRepo, s: HubSession, dryRun: boolean): BumpDecision {
	const name = hubRepoLabel(s, r);
	const link = r.link ?? "submodule";
	const res: RepoBumpResult = { repo: name, path: r.path, base: r.base, link, status: "skipped" };

	// Symlink: no hay gitlink en el hub; se dice explicitamente para que no parezca olvidado.
	if (link === "symlink") {
		return { res: { ...res, status: "not_applicable", detail: t("hub.bump_symlink_na") } };
	}
	if (!r.present) {
		const reason = t("hub.bump_not_on_disk");
		return { res: { ...res, reason, detail: reason } };
	}

	// Puntero actual: la entrada 160000 del índice del hub para esta ruta.
	const idx = git(s.root, ["ls-files", "-s", "--", r.path]).stdout.trim();
	const m = /^160000 ([0-9a-f]{40}) \d+\t/.exec(idx);
	if (!m) {
		const reason = t("hub.bump_not_in_index");
		return { res: { ...res, reason, detail: reason } };
	}
	const pointer = m[1];

	// Objetivo: el commit actual de la rama base en el submódulo (lo que `bond hub pull` avanza).
	const tgt = git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]);
	if (tgt.status !== 0 || !tgt.stdout.trim()) {
		const reason = t("hub.bump_base_not_found", { base: r.base });
		return { res: { ...res, reason, detail: reason } };
	}
	const to = tgt.stdout.trim();

	// Submódulo sucio: no se toca (issue #43, regla 6).
	const dirty = git(r.dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;
	if (dirty > 0) {
		const reason = t("hub.bump_dirty", { count: dirty });
		return { res: { ...res, reason, detail: reason } };
	}

	// HEAD del submódulo: si no es ni el puntero del hub ni la base, está desincronizado y no se toca.
	const head = git(r.dir, ["rev-parse", "--verify", "--quiet", "HEAD"]);
	if (head.status !== 0 || !head.stdout.trim()) {
		const reason = t("hub.bump_no_head");
		return { res: { ...res, reason, detail: reason } };
	}
	const h = head.stdout.trim();
	if (h !== pointer && h !== to) {
		const reason = t("hub.bump_desync", {
			head: shortSha(r.dir, h),
			pointer: shortSha(r.dir, pointer),
			base: shortSha(r.dir, to),
		});
		return { res: { ...res, reason, detail: reason } };
	}

	const from = shortSha(r.dir, pointer);
	const toShort = shortSha(r.dir, to);
	if (pointer === to) {
		return { res: { ...res, status: "up_to_date", from, to: toShort, detail: t("hub.bump_up_to_date") } };
	}
	if (dryRun) {
		return { res: { ...res, status: "moved", from, to: toShort, detail: t("hub.bump_would_move", { from, to: toShort, base: r.base }) } };
	}
	return {
		res: { ...res, status: "moved", from, to: toShort, detail: t("hub.bump_moved", { from, to: toShort, base: r.base }) },
		target: to,
		checkoutDetached: currentBranch(r.dir) === undefined && h !== to,
	};
}

export function bumpHubSession(s: HubSession, opts: BumpOpts = {}): HubBumpReport {
	const dryRun = opts.dryRun ?? isDryRun();
	// El propio hub (".") no tiene gitlink en sí mismo: bump solo mira los repos de la sesión.
	const decisions = s.repos.filter((r) => r.path !== ".").map((r) => decideBump(r, s, dryRun));
	const toMove = decisions.filter((d) => d.target);
	let commit: string | undefined;

	if (toMove.length && !dryRun) {
		// No commitear nada ajeno: si el hub ya tenía cosas staged, se aborta antes de tocar el índice.
		if (git(s.root, ["diff", "--cached", "--quiet"]).status !== 0) die(t("hub.bump_hub_staged"));
		for (const d of toMove) {
			const ui = git(s.root, ["update-index", "--cacheinfo", `160000,${d.target},${d.res.path}`]);
			if (ui.status !== 0) {
				const reason = t("hub.bump_update_index_failed", { error: firstLine(ui.stderr) });
				d.res = { ...d.res, status: "failed", reason, detail: reason };
				d.target = undefined;
			}
		}
		const still = toMove.filter((d) => d.target);
		if (still.length) {
			const c = git(s.root, ["commit", "-qm", "chore: bump submodules to base"]);
			if (c.status !== 0) {
				const reason = t("hub.bump_commit_failed", { error: firstLine(c.stderr) });
				for (const d of still) {
					d.res = { ...d.res, status: "failed", reason, detail: reason };
					d.target = undefined;
				}
			} else {
				commit = git(s.root, ["rev-parse", "--short", "HEAD"]).stdout.trim();
				// Un submódulo limpio en HEAD separado se actualiza al nuevo puntero para dejar el hub limpio.
				for (const d of still) {
					if (!d.checkoutDetached) continue;
					const repo = s.repos.find((r) => r.path === d.res.path);
					if (!repo) continue;
					const co = git(repo.dir, ["checkout", "-q", d.target!]);
					if (co.status !== 0) warn(t("hub.bump_checkout_failed", { name: d.res.repo, sha: d.res.to ?? "", error: firstLine(co.stderr) }));
				}
			}
		}
	}

	const repos = decisions.map((d) => d.res);
	return {
		hub: s.name,
		root: s.root,
		...(dryRun ? { dryRun: true } : {}),
		ok: !repos.some((rp) => rp.status === "failed"),
		...(commit ? { commit } : {}),
		repos,
	};
}

export function hubBumpJson(r: HubBumpReport): string {
	return JSON.stringify(r, null, 2);
}

export function printBump(r: HubBumpReport): void {
	log(`hub ${r.hub} ${dim(`(${r.root})`)}`);
	for (const rp of r.repos) {
		const labelStr = `${rp.repo} ${dim(`(${rp.path})`)}`;
		if (rp.status === "moved") {
			console.log(`  ${ok("✓")} ${labelStr}  ${rp.detail}`);
		} else if (rp.status === "up_to_date") {
			console.log(`  ${ok("✓")} ${labelStr}  ${dim(rp.detail ?? t("hub.bump_up_to_date"))}`);
		} else if (rp.status === "not_applicable") {
			console.log(`  ${dim("-")} ${labelStr}  ${dim(rp.detail ?? "")}`);
		} else if (rp.status === "skipped") {
			console.log(`  ${caution("!")} ${labelStr}  ${t("hub.bump_skipped_label", { detail: rp.detail ?? rp.reason ?? "" })}`);
		} else {
			console.log(`  ${bad("✗")} ${labelStr}  ${rp.detail ?? t("hub.bump_failed_fallback")}`);
		}
	}
	if (r.commit) console.log(`\n${ok("✓")} ${t("hub.bump_committed", { sha: r.commit })}`);
	const moved = r.repos.filter((rp) => rp.status === "moved").length;
	const upToDate = r.repos.filter((rp) => rp.status === "up_to_date").length;
	const skipped = r.repos.filter((rp) => rp.status === "skipped").length;
	const na = r.repos.filter((rp) => rp.status === "not_applicable").length;
	const failed = r.repos.filter((rp) => rp.status === "failed").length;
	const parts: string[] = [];
	if (moved) parts.push(t("hub.bump_summary_moved", { count: moved }));
	if (upToDate) parts.push(t("hub.bump_summary_up_to_date", { count: upToDate }));
	if (skipped) parts.push(t("hub.bump_summary_skipped", { count: skipped }));
	if (na) parts.push(t("hub.bump_summary_na", { count: na }));
	if (failed) parts.push(t("hub.bump_summary_failed", { count: failed }));
	const prefix = r.dryRun ? `${dim("[dry-run] ")} ` : "";
	const title = failed > 0 ? bad(t("hub.bump_pointers_checked")) : ok(t("hub.bump_pointers_checked"));
	console.log(`\n${prefix}${title}${parts.length ? dim(` · ${parts.join(" · ")}`) : ""}`);
}

export async function hubBump(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(hubBumpHelp().trimEnd());
		return;
	}
	const dryRun = args.includes("--dry-run");
	const json = args.includes("--json");
	if (dryRun) setDryRun(true);
	for (const a of args) {
		if (!["--json", "--dry-run"].includes(a)) {
			die(t("hub.bump_unknown_opt", { opt: a }));
		}
	}
	const root = hubRoot(process.cwd());
	if (!root) dieNotAHub();
	const s = hubSession(root);
	if (!s) die(t("hub.dir_not_a_hub", { name: root }));

	const report = bumpHubSession(s, { dryRun });
	if (json) console.log(hubBumpJson(report));
	else printBump(report);
	if (!report.ok) process.exitCode = 1;
}
