// bond hub pull: pone al día la rama base del hub y de cada repo de la sesión con git fetch y
// avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin cambios sin
// commitear, o actualizando la ref directamente si la base no tiene checkout en ningún worktree
// (p. ej. en un submódulo con HEAD separado). Si un repo tiene cambios en su checkout de la base,
// la base tiene checkout en otro worktree, ha divergido o no tiene remoto/upstream, lo salta y
// explica el motivo. Nunca hace merge, rebase ni push.
// Con --dry-run y --json.

import { currentBranch, hubRepoLabel, hubRoot, hubSession, type HubRepo, type HubSession } from "./hub.mts";
import { gitWorktrees } from "./team.mts";
import { bad, canonical, caution, die, dim, isDryRun, log, ok, run, setDryRun } from "./util.mts";

export const HUB_PULL_HELP = `Uso: bond hub pull [opciones]

Pone al día la rama base del hub y de cada repo de la sesión con git fetch y
avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin
cambios sin commitear, o avanzando directamente la ref si la base no tiene
checkout en ningún worktree (p. ej. en un submódulo con HEAD separado). Si la
base tiene cambios en su checkout, está en uso en otro worktree, ha divergido o
no tiene remoto/upstream, lo salta y explica el motivo.
Nunca hace merge, rebase ni push.

Opciones:
  --dry-run   Describe los avances sin hacer fetch ni mover las ramas.
  --json      Salida en JSON con el resultado por repo.
`;

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
		return { ...res, reason: "no está en disco", detail: "no está en disco" };
	}

	// 2. Base declarada existe
	if (git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status !== 0) {
		return { ...res, reason: `la base "${r.base}" no existe`, detail: `la base "${r.base}" no existe` };
	}

	// 3. Tiene remoto configurado
	const remotes = git(r.dir, ["remote"]).stdout.split("\n").filter(Boolean);
	if (!remotes.length) {
		return { ...res, reason: "sin remoto configurado", detail: "sin remoto configurado" };
	}

	// 4. Upstream de la base
	const remoteConfig = git(r.dir, ["config", `branch.${r.base}.remote`]).stdout.trim();
	const upInitial = git(r.dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${r.base}@{upstream}`]);
	if (!remoteConfig && upInitial.status !== 0) {
		return { ...res, reason: `la base "${r.base}" no tiene upstream configurado`, detail: `la base "${r.base}" no tiene upstream configurado` };
	}
	const remote = remoteConfig || (upInitial.status === 0 ? upInitial.stdout.trim().split("/")[0] : undefined) || remotes[0];

	// 5. Comprobar dónde tiene checkout la base. Si es la rama actual de este repo no puede estar
	// en otro worktree (git no lo permite); así no depende de la ruta que dé git worktree list,
	// que en un submódulo es la de su carpeta en .git/modules y no la del repo.
	const isCheckedOutHere = currentBranch(r.dir) === r.base;
	const checkedOutElsewhere = isCheckedOutHere ? undefined : gitWorktrees(r.dir).find((w) => w.branch === r.base && w.path !== canonical(r.dir));
	if (checkedOutElsewhere) {
		const reason = `la base "${r.base}" tiene checkout en otro worktree (${checkedOutElsewhere.path})`;
		return { ...res, reason, detail: reason };
	}
	if (isCheckedOutHere) {
		const dirty = git(r.dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;
		if (dirty > 0) {
			const reason = `${dirty} cambio(s) sin commitear`;
			return { ...res, reason, detail: reason };
		}
	}

	// 6. git fetch (si no es --dry-run)
	if (!dryRun) {
		const f = git(r.dir, ["fetch", "--quiet", remote]);
		if (f.status !== 0) {
			return { ...res, reason: `git fetch falló: ${firstLine(f.stderr)}`, detail: `git fetch falló: ${firstLine(f.stderr)}` };
		}
	}

	// 7. Resolver upstream tras fetch o en --dry-run
	const upResolved = git(r.dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${r.base}@{upstream}`]);
	if (upResolved.status !== 0 || !upResolved.stdout.trim()) {
		return { ...res, reason: `la base "${r.base}" no tiene upstream configurado`, detail: `la base "${r.base}" no tiene upstream configurado` };
	}
	const upstream = upResolved.stdout.trim();

	// 8. Comprobar ahead / behind
	const countRes = git(r.dir, ["rev-list", "--left-right", "--count", `${r.base}...${upstream}`]);
	if (countRes.status !== 0) {
		return { ...res, upstream, reason: `no se pudo comparar ${r.base} con ${upstream}`, detail: `no se pudo comparar ${r.base} con ${upstream}` };
	}
	const [ahead = 0, behind = 0] = countRes.stdout.trim().split(/\s+/).map(Number);

	// 9. Evaluar estado
	if (behind === 0) {
		return { ...res, status: "up_to_date", upstream, commits: 0, detail: "al día" };
	}

	if (ahead > 0 && behind > 0) {
		const reason = `la base ha divergido de ${upstream} (${ahead} por delante, ${behind} por detrás)`;
		return { ...res, status: "skipped", upstream, reason, detail: reason };
	}

	// ahead === 0 && behind > 0: avance en fast-forward
	if (dryRun) {
		return {
			...res,
			status: "updated",
			upstream,
			commits: behind,
			detail: `avanzaría ${behind} commit(s) a ${upstream} (fast-forward)`,
		};
	}

	if (isCheckedOutHere) {
		const ff = git(r.dir, ["merge", "--ff-only", upstream]);
		if (ff.status !== 0) {
			return {
				...res,
				status: "failed",
				upstream,
				reason: `fast-forward falló: ${firstLine(ff.stderr)}`,
				detail: `fast-forward falló: ${firstLine(ff.stderr)}`,
			};
		}
		return {
			...res,
			status: "updated",
			upstream,
			commits: behind,
			detail: `avanzado ${behind} commit(s) a ${upstream} (fast-forward)`,
		};
	}

	// La base no tiene checkout en ningún worktree (p. ej. submódulo con HEAD separado):
	// avance directo de la ref con fetch fast-forward (sin '+' para rechazar si no es ff)
	const ffFetch = git(r.dir, ["fetch", remote, `${r.base}:${r.base}`]);
	if (ffFetch.status !== 0) {
		return {
			...res,
			status: "failed",
			upstream,
			reason: `fast-forward falló: ${firstLine(ffFetch.stderr)}`,
			detail: `fast-forward falló: ${firstLine(ffFetch.stderr)}`,
		};
	}
	return {
		...res,
		status: "updated",
		upstream,
		commits: behind,
		detail: `avanzado ${behind} commit(s) a ${upstream} (fast-forward)`,
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
			console.log(`  ${ok("✓")} ${labelStr}  ${dim(rp.detail ?? "al día")}`);
		} else if (rp.status === "skipped") {
			console.log(`  ${caution("!")} ${labelStr}  saltado: ${rp.detail ?? rp.reason}`);
		} else {
			console.log(`  ${bad("✗")} ${labelStr}  ${rp.detail ?? "falló"}`);
		}
	}
	const updated = r.repos.filter((rp) => rp.status === "updated").length;
	const upToDate = r.repos.filter((rp) => rp.status === "up_to_date").length;
	const skipped = r.repos.filter((rp) => rp.status === "skipped").length;
	const failed = r.repos.filter((rp) => rp.status === "failed").length;
	const parts: string[] = [];
	if (updated) parts.push(`${updated} actualizado(s)`);
	if (upToDate) parts.push(`${upToDate} al día`);
	if (skipped) parts.push(`${skipped} saltado(s)`);
	if (failed) parts.push(`${failed} con fallo`);
	const prefix = r.dryRun ? `${dim("[dry-run]")} ` : "";
	const title = failed > 0 ? bad("bases revisadas") : ok("bases revisadas");
	console.log(`\n${prefix}${title}${parts.length ? dim(` · ${parts.join(" · ")}`) : ""}`);
}

export async function hubPull(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_PULL_HELP.trimEnd());
		return;
	}
	const dryRun = args.includes("--dry-run");
	const json = args.includes("--json");
	if (dryRun) setDryRun(true);
	for (const a of args) {
		if (!["--json", "--dry-run"].includes(a)) {
			die(`opción desconocida: ${a} (bond hub pull --help)`);
		}
	}
	const root = hubRoot(process.cwd());
	if (!root) die("no es un hub: falta hub.toml (bond hub --help)");
	const s = hubSession(root);
	if (!s) die(`${root} no es un hub: falta hub.toml`);

	const report = pullHubSession(s, { dryRun });
	if (json) console.log(hubPullJson(report));
	else printPull(report);
	if (!report.ok) process.exitCode = 1;
}
