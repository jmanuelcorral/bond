// bond hub pull: pone al día la rama base del hub y de cada repo de la sesión con git fetch y
// avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin cambios sin
// commitear, o actualizando la ref directamente si la base no tiene checkout en ningún worktree
// (p. ej. en un submódulo con HEAD separado). Si un repo tiene cambios en su checkout de la base,
// la base tiene checkout en otro worktree, ha divergido o no tiene remoto/upstream, lo salta y
// explica el motivo. Nunca hace merge, rebase ni push.
// Con --dry-run y --json.

import { currentBranch, dieNotAHub, hubRepoLabel, hubRoot, hubSession, type HubRepo, type HubSession } from "./hub.mts";
import { gitWorktrees } from "./team.mts";
import { bad, canonical, caution, die, dim, isDryRun, log, ok, run, setDryRun } from "./util.mts";
import { aheadBehind, dirtyCount, upstreamOf } from "./hub-status.mts";
import { t } from "./messages.mts";

export const hubPullHelp = (): string => t("hub.pull.help");

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
const firstLine = (s: string) => s.trim().split("\n")[0] ?? "";

export type PullStatus = "updated" | "up_to_date" | "skipped" | "failed";

export interface RepoPullResult {
	repo: string;
	path: string;
	base: string;
	status: PullStatus;
	detail?: string;
	commits?: number;
	upstream?: string;
	reason?: string;
}

export interface HubPullReport {
	hub: string;
	root: string;
	dryRun?: boolean;
	ok: boolean;
	repos: RepoPullResult[];
}

export interface PullOpts {
	dryRun?: boolean;
}

export function pullRepo(r: HubRepo, s: HubSession, opts: PullOpts = {}): RepoPullResult {
	const name = hubRepoLabel(s, r);
	const res: RepoPullResult = { repo: name, path: r.path, base: r.base, status: "skipped" };
	const dryRun = opts.dryRun ?? isDryRun();

	// 1. Repo en disco
	if (!r.present) {
		const reason = t("hub.pull_not_on_disk");
		return { ...res, reason, detail: reason };
	}

	// 2. Base declarada existe
	if (git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status !== 0) {
		const reason = t("hub.pull_base_not_found", { base: r.base });
		return { ...res, reason, detail: reason };
	}

	// 3. Tiene remoto configurado
	const remotes = git(r.dir, ["remote"]).stdout.split("\n").filter(Boolean);
	if (!remotes.length) {
		const reason = t("hub.pull_no_remote");
		return { ...res, reason, detail: reason };
	}

	// 4. Upstream de la base
	const remoteConfig = git(r.dir, ["config", `branch.${r.base}.remote`]).stdout.trim();
	const upInitial = upstreamOf(r.dir, r.base);
	if (!remoteConfig && !upInitial) {
		const reason = t("hub.pull_no_upstream", { base: r.base });
		return { ...res, reason, detail: reason };
	}
	const remote = remoteConfig || upInitial?.split("/")[0] || remotes[0];

	// 5. Comprobar dónde tiene checkout la base. Si es la rama actual de este repo no puede estar
	// en otro worktree (git no lo permite); así no depende de la ruta que dé git worktree list,
	// que en un submódulo es la de su carpeta en .git/modules y no la del repo.
	const isCheckedOutHere = currentBranch(r.dir) === r.base;
	const checkedOutElsewhere = isCheckedOutHere ? undefined : gitWorktrees(r.dir).find((w) => w.branch === r.base && w.path !== canonical(r.dir));
	if (checkedOutElsewhere) {
		const reason = t("hub.pull_checked_out_elsewhere", { base: r.base, path: checkedOutElsewhere.path });
		return { ...res, reason, detail: reason };
	}
	if (isCheckedOutHere) {
		const dirty = dirtyCount(r.dir);
		if (dirty > 0) {
			const reason = t("hub.pull_dirty_changes", { count: dirty });
			return { ...res, reason, detail: reason };
		}
	}

	// 6. git fetch (si no es --dry-run)
	if (!dryRun) {
		const f = git(r.dir, ["fetch", "--quiet", remote]);
		if (f.status !== 0) {
			const reason = t("hub.pull_fetch_failed", { error: firstLine(f.stderr) });
			return { ...res, reason, detail: reason };
		}
	}

	// 7. Resolver upstream tras fetch o en --dry-run
	const upstream = upstreamOf(r.dir, r.base);
	if (!upstream) {
		const reason = t("hub.pull_no_upstream", { base: r.base });
		return { ...res, reason, detail: reason };
	}

	// 8. Comprobar ahead / behind
	const ab = aheadBehind(r.dir, r.base, upstream);
	if (!ab) {
		const reason = t("hub.pull_compare_failed", { base: r.base, upstream });
		return { ...res, upstream, reason, detail: reason };
	}
	const { ahead, behind } = ab;

	// 9. Evaluar estado
	if (behind === 0) {
		return { ...res, status: "up_to_date", upstream, commits: 0, detail: t("hub.pull_up_to_date") };
	}

	if (ahead > 0 && behind > 0) {
		const reason = t("hub.pull_diverged", { upstream, ahead, behind });
		return { ...res, status: "skipped", upstream, reason, detail: reason };
	}

	// ahead === 0 && behind > 0: avance en fast-forward
	if (dryRun) {
		return {
			...res,
			status: "updated",
			upstream,
			commits: behind,
			detail: t("hub.pull_would_advance", { count: behind, upstream }),
		};
	}

	if (isCheckedOutHere) {
		const ff = git(r.dir, ["merge", "--ff-only", upstream]);
		if (ff.status !== 0) {
			const reason = t("hub.pull_ff_failed", { error: firstLine(ff.stderr) });
			return {
				...res,
				status: "failed",
				upstream,
				reason,
				detail: reason,
			};
		}
		return {
			...res,
			status: "updated",
			upstream,
			commits: behind,
			detail: t("hub.pull_advanced", { count: behind, upstream }),
		};
	}

	// La base no tiene checkout en ningún worktree (p. ej. submódulo con HEAD separado):
	// avance directo de la ref con fetch fast-forward (sin '+' para rechazar si no es ff)
	const ffFetch = git(r.dir, ["fetch", remote, `${r.base}:${r.base}`]);
	if (ffFetch.status !== 0) {
		const reason = t("hub.pull_ff_failed", { error: firstLine(ffFetch.stderr) });
		return {
			...res,
			status: "failed",
			upstream,
			reason,
			detail: reason,
		};
	}
	return {
		...res,
		status: "updated",
		upstream,
		commits: behind,
		detail: t("hub.pull_advanced", { count: behind, upstream }),
	};
}

export function pullHubSession(s: HubSession, opts: PullOpts = {}): HubPullReport {
	const repos = s.repos.map((r) => pullRepo(r, s, opts));
	const ok = !repos.some((rp) => rp.status === "failed");
	return {
		hub: s.name,
		root: s.root,
		...(opts.dryRun ? { dryRun: true } : {}),
		ok,
		repos,
	};
}

export function hubPullJson(r: HubPullReport): string {
	return JSON.stringify(r, null, 2);
}

export function printPull(r: HubPullReport): void {
	log(`hub ${r.hub} ${dim(`(${r.root})`)}`);
	for (const rp of r.repos) {
		const labelStr = `${rp.repo} ${dim(`(${rp.path})`)}`;
		if (rp.status === "updated") {
			console.log(`  ${ok("✓")} ${labelStr}  ${rp.detail}`);
		} else if (rp.status === "up_to_date") {
			console.log(`  ${ok("✓")} ${labelStr}  ${dim(rp.detail ?? t("hub.pull_up_to_date"))}`);
		} else if (rp.status === "skipped") {
			console.log(`  ${caution("!")} ${labelStr}  ${t("hub.pull_skipped_label", { detail: rp.detail ?? rp.reason ?? "" })}`);
		} else {
			console.log(`  ${bad("✗")} ${labelStr}  ${rp.detail ?? t("hub.pull_failed_fallback")}`);
		}
	}
	const updated = r.repos.filter((rp) => rp.status === "updated").length;
	const upToDate = r.repos.filter((rp) => rp.status === "up_to_date").length;
	const skipped = r.repos.filter((rp) => rp.status === "skipped").length;
	const failed = r.repos.filter((rp) => rp.status === "failed").length;
	const parts: string[] = [];
	if (updated) parts.push(t("hub.pull_summary_updated", { count: updated }));
	if (upToDate) parts.push(t("hub.pull_summary_up_to_date", { count: upToDate }));
	if (skipped) parts.push(t("hub.pull_summary_skipped", { count: skipped }));
	if (failed) parts.push(t("hub.pull_summary_failed", { count: failed }));
	const prefix = r.dryRun ? `${dim("[dry-run]")} ` : "";
	const title = failed > 0 ? bad(t("hub.pull_bases_checked")) : ok(t("hub.pull_bases_checked"));
	console.log(`\n${prefix}${title}${parts.length ? dim(` · ${parts.join(" · ")}`) : ""}`);
}

export async function hubPull(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(hubPullHelp().trimEnd());
		return;
	}
	const dryRun = args.includes("--dry-run");
	const json = args.includes("--json");
	if (dryRun) setDryRun(true);
	for (const a of args) {
		if (!["--json", "--dry-run"].includes(a)) {
			die(t("hub.pull_unknown_opt", { opt: a }));
		}
	}
	const root = hubRoot(process.cwd());
	if (!root) dieNotAHub();
	const s = hubSession(root);
	if (!s) die(t("hub.dir_not_a_hub", { name: root }));

	const report = pullHubSession(s, { dryRun });
	if (json) console.log(hubPullJson(report));
	else printPull(report);
	if (!report.ok) process.exitCode = 1;
}
