// bond hub pull: pone al día la rama base del hub y de cada repo de la sesión con git fetch y
// avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin cambios sin
// commitear. Si un repo tiene cambios, está en otra rama, su base ha divergido o no tiene
// remoto/upstream, lo salta y explica el motivo. Nunca hace merge, rebase ni push.
// Con --dry-run y --json.

import { currentBranch, hubRoot, hubSession, type HubRepo, type HubSession } from "./hub.mts";
import { bad, caution, die, dim, isDryRun, log, ok, run, setDryRun } from "./util.mts";

export const HUB_PULL_HELP = `Uso: bond hub pull [opciones]

Pone al día la rama base del hub y de cada repo de la sesión con git fetch y
avance en fast-forward (D19). Solo actúa si el repo está en su rama base y sin
cambios sin commitear. Si un repo tiene cambios, está en otra rama, su base ha
divergido o no tiene remoto/upstream, lo salta y explica el motivo.
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

const label = (s: HubSession, r: HubRepo) => (r.path === "." ? s.name : (r.name ?? r.path));

export function pullRepo(r: HubRepo, s: HubSession, opts: PullOpts = {}): RepoPullResult {
	const name = label(s, r);
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

	// 3. Está en su rama base
	const branch = currentBranch(r.dir);
	if (branch !== r.base) {
		const reason = branch ? `en la rama "${branch}" (no en su base "${r.base}")` : `HEAD separado (no en su base "${r.base}")`;
		return { ...res, reason, detail: reason };
	}

	// 4. Sin cambios sin commitear
	const dirty = git(r.dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;
	if (dirty > 0) {
		const reason = `${dirty} cambio(s) sin commitear`;
		return { ...res, reason, detail: reason };
	}

	// 5. Tiene remoto configurado
	const remotes = git(r.dir, ["remote"]).stdout.split("\n").filter(Boolean);
	if (!remotes.length) {
		return { ...res, reason: "sin remoto configurado", detail: "sin remoto configurado" };
	}

	// 6. Upstream de la base
	const remoteConfig = git(r.dir, ["config", `branch.${r.base}.remote`]).stdout.trim();
	const upInitial = git(r.dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${r.base}@{upstream}`]);
	if (!remoteConfig && upInitial.status !== 0) {
		return { ...res, reason: `la base "${r.base}" no tiene upstream configurado`, detail: `la base "${r.base}" no tiene upstream configurado` };
	}

	// 7. git fetch (si no es --dry-run)
	if (!dryRun) {
		const fetchArgs = remoteConfig ? ["fetch", "--quiet", remoteConfig] : ["fetch", "--quiet"];
		const f = git(r.dir, fetchArgs);
		if (f.status !== 0) {
			return { ...res, reason: `git fetch falló: ${firstLine(f.stderr)}`, detail: `git fetch falló: ${firstLine(f.stderr)}` };
		}
	}

	// 8. Resolver upstream tras fetch o en --dry-run
	const upResolved = git(r.dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${r.base}@{upstream}`]);
	if (upResolved.status !== 0 || !upResolved.stdout.trim()) {
		return { ...res, reason: `la base "${r.base}" no tiene upstream configurado`, detail: `la base "${r.base}" no tiene upstream configurado` };
	}
	const upstream = upResolved.stdout.trim();

	// 9. Comprobar ahead / behind
	const countRes = git(r.dir, ["rev-list", "--left-right", "--count", `${r.base}...${upstream}`]);
	if (countRes.status !== 0) {
		return { ...res, upstream, reason: `no se pudo comparar ${r.base} con ${upstream}`, detail: `no se pudo comparar ${r.base} con ${upstream}` };
	}
	const [ahead = 0, behind = 0] = countRes.stdout.trim().split(/\s+/).map(Number);

	// 10. Evaluar estado
	if (behind === 0) {
		return { ...res, status: "up_to_date", upstream, commits: 0, detail: "al día" };
	}

	if (ahead > 0 && behind > 0) {
		const reason = `la base ha divergido de ${upstream} (${ahead} por delante, ${behind} por detrás)`;
		return { ...res, status: "skipped", upstream, reason, detail: reason };
	}

	// ahead === 0 && behind > 0: fast-forward
	if (dryRun) {
		return {
			...res,
			status: "updated",
			upstream,
			commits: behind,
			detail: `avanzaría ${behind} commit(s) a ${upstream} (fast-forward)`,
		};
	}

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
	console.log(`\n${prefix}${ok("bases revisadas")}${parts.length ? dim(` · ${parts.join(" · ")}`) : ""}`);
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
