// bond hub check: revisa cada repo de la sesión del hub y dice qué falta y cómo arreglarlo:
// que existe y es un repo git, que su enlace es el que dice hub.toml, que tiene la base, que
// tiene bond init hecho y su config al día, que sus agentes están instalados, que admite
// worktrees y que no tiene cambios sin commitear ni una rama vertical a medias. Con --fix
// arregla solo lo seguro (enlazar con linkRepo, git submodule update --init); nunca descarta
// cambios ni cambia de rama un repo. Lo demás se ofrece con el comando a pasar.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { dieNotAHub, hubRepoLabel, hubRoot, hubSession, registerHubRepo, submodules, type HubRepo, type HubSession } from "./hub.mts";
import { linkRepo } from "./hub-init.mts";
import { agentInstalled } from "./catalog-agents.mts";
import { gitWorktrees } from "./team.mts";
import { loadRepoAgents, syncRepo } from "./repo.mts";
import { act, bad, brokenLink, canonical, catchDie, caution, die, dim, isDryRun, linkTarget, log, ok, run, setDryRun, warn } from "./util.mts";
import { t } from "./messages.mts";

export const hubCheckHelp = (): string => t("hub.check.help");

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
const firstLine = (s: string) => s.trim().split("\n")[0] ?? "";

/** Como en bond doctor: un aviso se muestra pero no impide trabajar ni cambia la salida. */
export type CheckLevel = "ok" | "warn" | "fail";

/** El peor nivel de una lista: fail sobre warn sobre ok. */
export const worstLevel = (levels: CheckLevel[]): CheckLevel => (levels.includes("fail") ? "fail" : levels.includes("warn") ? "warn" : "ok");

export interface HubCheck {
	check: string;
	level: CheckLevel;
	detail?: string;
	fix?: string;
	/** Cambio seguro que aplica --fix. No se incluye en --json. */
	fixFn?: () => void;
}

export interface RepoReport {
	repo: string;
	path: string;
	/** El peor nivel de sus comprobaciones. */
	level: CheckLevel;
	checks: HubCheck[];
}

export interface HubCheckReport {
	hub: string;
	root: string;
	/** El peor nivel de la sesión; el código de salida es 1 solo con fail. */
	level: CheckLevel;
	failures: number;
	warnings: number;
	repos: RepoReport[];
}

export interface CheckOpts {
	/** Sustituible en las pruebas: ¿está el agente instalado? */
	hasAgent?: (agent: string) => boolean;
}

/** Aviso (D17/D19): la base va por detrás de su remoto según el último fetch. */
function baseBehindCheck(r: HubRepo): HubCheck[] {
	const up = git(r.dir, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${r.base}@{upstream}`]);
	if (up.status !== 0 || !up.stdout.trim()) return [];
	const upstream = up.stdout.trim();
	const count = git(r.dir, ["rev-list", "--left-right", "--count", `${r.base}...${upstream}`]);
	if (count.status !== 0) return [];
	const [, behind = 0] = count.stdout.trim().split(/\s+/).map(Number);
	if (behind <= 0) return [];
	return [{
		check: t("hub.check_base_behind"),
		level: "warn",
		detail: t("hub.check_base_behind_detail", { count: behind, upstream }),
		fix: "bond hub pull",
	}];
}

/** Aviso (D16/D17): un repo declarado fuera de repos/, la ruta por defecto de los hubs nuevos. */
function routeChecks(r: HubRepo): HubCheck[] {
	if (r.path === "." || r.path.startsWith("repos/")) return [];
	return [{
		check: t("hub.check_route"),
		level: "warn",
		detail: t("hub.check_route_detail"),
		fix: t("hub.check_route_fix"),
	}];
}

/** Enlaza el clon local en la ruta del hub y registra ambos en el registro global (D14). */
function fixLink(r: HubRepo, s: HubSession): void {
	linkRepo(r.source!, r.dir);
	registerHubRepo(r.source!, s.root);
	registerHubRepo(r.dir, s.root);
}

/** Las comprobaciones de un repo de la sesión. Si no está en disco, solo se reporta eso. */
function checkRepo(r: HubRepo, s: HubSession, hasAgent: (agent: string) => boolean): HubCheck[] {
	const name = hubRepoLabel(s, r);
	// El aviso de ruta depende solo de la declaración, no de que el repo esté en disco.
	const checks: HubCheck[] = [...routeChecks(r)];

	// 1. Existe y es un repo git.
	if (!r.present) {
		if (r.link === "submodule") {
			checks.push({
				check: t("hub.check_exists"),
				level: "fail",
				detail: t("hub.check_submodule_uninit"),
				fix: t("hub.check_submodule_fix", { root: s.root, path: r.path }),
				fixFn: () => {
					const g = git(s.root, ["submodule", "update", "--init", "--", r.path]);
					if (g.status !== 0) warn(t("hub.check_fix_submodule_warn", { name, error: firstLine(g.stderr) }));
					else log(t("hub.check_fix_submodule_log", { name }));
				},
			});
		} else if (!r.source) {
			checks.push({ check: t("hub.check_exists"), level: "fail", detail: t("hub.check_missing_link_no_source"), fix: t("hub.check_missing_link_no_source_fix") });
		} else if (!existsSync(r.source)) {
			checks.push({ check: t("hub.check_exists"), level: "fail", detail: t("hub.check_missing_link_source_not_found", { source: r.source }), fix: t("hub.check_missing_link_source_not_found_fix") });
		} else if (brokenLink(r.dir)) {
			checks.push({
				check: t("hub.check_exists"),
				level: "fail",
				detail: t("hub.check_broken_link_detail", { target: linkTarget(r.dir) ?? "" }),
				fix: "bond hub check --fix",
				fixFn: () => fixLink(r, s),
			});
		} else if (existsSync(r.dir)) {
			checks.push({ check: t("hub.check_exists"), level: "fail", detail: t("hub.check_path_not_git"), fix: t("hub.check_path_not_git_fix", { path: r.path, dir: r.dir }) });
		} else {
			checks.push({
				check: t("hub.check_exists"),
				level: "fail",
				detail: t("hub.check_missing_link_to_source", { source: r.source! }),
				fix: "bond hub check --fix",
				fixFn: () => fixLink(r, s),
			});
		}
		return checks;
	}

	// 2. El enlace es el que dice hub.toml (symlink y submódulo se reportan igual).
	if (r.link === "symlink") {
		const isLink = linkTarget(r.dir) !== undefined;
		if (!isLink) checks.push({ check: t("hub.check_link"), level: "fail", detail: t("hub.check_link_is_normal_dir"), fix: t("hub.check_link_is_normal_dir_fix") });
		else if (r.source && canonical(r.dir) !== canonical(r.source)) checks.push({ check: t("hub.check_link"), level: "fail", detail: t("hub.check_link_points_elsewhere", { actual: canonical(r.dir), expected: canonical(r.source) }), fix: t("hub.check_link_points_elsewhere_fix") });
		else checks.push({ check: t("hub.check_link"), level: "ok", detail: t("hub.check_link_symlink_ok", { target: canonical(r.dir) }) });
	} else if (r.link === "submodule") {
		checks.push(
			submodules(s.root).some((m) => m.path === r.path)
				? { check: t("hub.check_link"), level: "ok", detail: t("hub.check_link_submodule_ok") }
				: { check: t("hub.check_link"), level: "fail", detail: t("hub.check_link_submodule_not_reg"), fix: t("hub.check_link_submodule_not_reg_fix") },
		);
	}

	// 3. Tiene la base declarada.
	const hasBase = git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status === 0;
	checks.push(hasBase ? { check: t("hub.check_base"), level: "ok", detail: r.base } : { check: t("hub.check_base"), level: "fail", detail: t("hub.check_base_not_found", { base: r.base, name }), fix: t("hub.check_base_not_found_fix") });
	if (hasBase) checks.push(...baseBehindCheck(r));

	// 4. bond init hecho y config de agentes al día (bond sync --check).
	if (!existsSync(join(r.dir, ".bond", "bond.toml"))) {
		checks.push({ check: t("hub.check_bond_init"), level: "fail", detail: t("hub.check_bond_init_missing"), fix: t("hub.check_bond_init_missing_fix") });
	} else {
		const prev = process.cwd();
		let cfgActions: ReturnType<typeof syncRepo> | undefined;
		let cfgError: string | undefined;
		try {
			process.chdir(r.dir);
			const cfg = catchDie(() => syncRepo({ check: true, quiet: true }));
			cfgActions = cfg.value;
			cfgError = cfg.error;
		} finally {
			process.chdir(prev);
		}
		if (cfgError !== undefined) checks.push({ check: t("hub.check_config"), level: "fail", detail: cfgError, fix: t("hub.check_config_fix", { dir: r.dir }) });
		else if (cfgActions && cfgActions.length) checks.push({ check: t("hub.check_config"), level: "fail", detail: t("hub.check_config_pending", { count: cfgActions.length }), fix: t("hub.check_config_fix", { dir: r.dir }) });
		else checks.push({ check: t("hub.check_config"), level: "ok", detail: t("hub.check_config_up_to_date") });

		// 5. Sus agentes están instalados (los de su bond.toml y el agent de hub.toml).
		const agents = catchDie(() => loadRepoAgents(r.dir));
		if (agents.error !== undefined) checks.push({ check: t("hub.check_agents"), level: "fail", detail: agents.error, fix: t("hub.check_agents_review_fix") });
		else {
			const wanted = [...new Set([...agents.value.agents, ...(r.agent ? [r.agent] : [])])];
			const missing = wanted.filter((a) => !hasAgent(a));
			checks.push(missing.length ? { check: t("hub.check_agents"), level: "fail", detail: t("hub.check_agents_missing", { list: missing.join(", ") }), fix: t("hub.check_agents_missing_fix") } : { check: t("hub.check_agents"), level: "ok", detail: wanted.length ? wanted.join(", ") : t("hub.check_agents_none") });
		}
	}

	// 6. Admite worktrees (bond team trabaja con worktrees).
	const bare = git(r.dir, ["rev-parse", "--is-bare-repository"]).stdout.trim() === "true";
	const wt = !bare && git(r.dir, ["worktree", "list", "--porcelain"]).status === 0;
	checks.push(wt ? { check: t("hub.check_worktrees"), level: "ok" } : { check: t("hub.check_worktrees"), level: "fail", detail: bare ? t("hub.check_worktrees_bare") : t("hub.check_worktrees_failed", { name }), fix: bare ? t("hub.check_worktrees_bare_fix") : undefined });

	// 7. Sin cambios sin commitear (bond team sale de lo commiteado).
	const dirty = git(r.dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;
	checks.push(dirty ? { check: t("hub.check_changes"), level: "fail", detail: t("hub.check_changes_dirty", { count: dirty }), fix: t("hub.check_changes_dirty_fix") } : { check: t("hub.check_changes"), level: "ok", detail: t("hub.check_changes_clean") });

	return checks;
}

/**
 * Ramas verticales a medias en la sesión: worktrees en repos de la sesión cuya rama no existe
 * en el hub (bond team las crea en los dos), o más de una rama vertical abierta (D10).
 * Las bases de la sesión no cuentan.
 */
function verticalChecks(s: HubSession): HubCheck[] {
	const bases = new Set(s.repos.map((x) => x.base));
	const byBranch = new Map<string, string[]>();
	for (const r of s.repos) {
		if (r.path === "." || !r.present) continue;
		for (const w of gitWorktrees(r.dir)) {
			if (w.main || !w.branch || bases.has(w.branch)) continue;
			byBranch.set(w.branch, [...(byBranch.get(w.branch) ?? []), r.path]);
		}
	}
	const checks: HubCheck[] = [];
	const branches = [...byBranch.keys()].sort();
	for (const branch of branches) {
		if (git(s.root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status !== 0) {
			checks.push({ check: t("hub.check_vertical_branch"), level: "fail", detail: t("hub.check_vertical_missing_in_hub", { branch, repos: byBranch.get(branch)!.join(", ") }), fix: t("hub.check_vertical_missing_in_hub_fix", { branch }) });
		}
	}
	if (branches.length > 1) checks.push({ check: t("hub.check_vertical_branch"), level: "fail", detail: t("hub.check_vertical_multiple", { branches: branches.join(", ") }), fix: t("hub.check_vertical_multiple_fix", { branch: branches[0] }) });
	if (!checks.length) checks.push({ check: t("hub.check_vertical_branch"), level: "ok", detail: branches.length === 1 ? t("hub.check_vertical_one", { branch: branches[0] }) : t("hub.check_vertical_none") });
	return checks;
}

/** El informe completo de la sesión: una fila de comprobaciones por repo. */
export function checkHubSession(s: HubSession, opts: CheckOpts = {}): HubCheckReport {
	const hasAgent = opts.hasAgent ?? agentInstalled;
	const repos: RepoReport[] = s.repos.map((r) => {
		const checks = checkRepo(r, s, hasAgent);
		if (r.path === ".") checks.push(...verticalChecks(s));
		return { repo: hubRepoLabel(s, r), path: r.path, level: worstLevel(checks.map((c) => c.level)), checks };
	});
	const all = repos.flatMap((rp) => rp.checks);
	const failures = all.filter((c) => c.level === "fail").length;
	const warnings = all.filter((c) => c.level === "warn").length;
	return { hub: s.name, root: s.root, level: worstLevel(repos.map((rp) => rp.level)), failures, warnings, repos };
}

/** El informe en JSON, sin las funciones de arreglo. */
export function hubCheckJson(r: HubCheckReport): string {
	return JSON.stringify(
		{
			...r,
			repos: r.repos.map((rp) => ({
				...rp,
				checks: rp.checks.map(({ fixFn: _fixFn, ...c }) => c),
			})),
		},
		null,
		2,
	);
}

function printCheck(r: HubCheckReport): void {
	log(`hub ${r.hub} ${dim(`(${r.root})`)}`);
	for (const rp of r.repos) {
		const failed = rp.checks.filter((c) => c.level === "fail");
		const warned = rp.checks.filter((c) => c.level === "warn");
		if (!failed.length && !warned.length) {
			console.log(`  ${ok("✓")} ${rp.repo} ${dim(`(${rp.path})`)}`);
			continue;
		}
		console.log(`  ${failed.length ? bad("✗") : caution("!")} ${rp.repo} ${dim(`(${rp.path})`)}`);
		for (const c of failed) console.log(`      ${bad("✗")} ${c.check.padEnd(13)} ${c.detail ?? ""}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
		for (const c of warned) console.log(`      ${caution("!")} ${c.check.padEnd(13)} ${c.detail ?? ""}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
	}
	const warnHint = r.warnings ? dim(t("hub.check_warn_hint", { count: r.warnings })) : "";
	console.log(r.level !== "fail" ? `\n${ok(t("hub.check_ok"))}${warnHint}` : `\n${bad(t("hub.check_failures", { count: r.failures }))}` + dim(fixableHint(r)));
}

const fixableHint = (r: HubCheckReport) => (r.repos.some((rp) => rp.checks.some((c) => c.level === "fail" && c.fixFn)) ? t("hub.check_fixable_hint") : "");

export async function hubCheck(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(hubCheckHelp().trimEnd());
		return;
	}
	if (args.includes("--dry-run")) setDryRun(true);
	const fix = args.includes("--fix");
	const json = args.includes("--json");
	const yes = args.includes("--yes") || args.includes("-y");
	for (const a of args) if (!["--fix", "--json", "--dry-run", "--yes", "-y"].includes(a)) die(t("hub.check_unknown_opt", { opt: a }));
	const root = hubRoot(process.cwd());
	if (!root) dieNotAHub();
	const s = hubSession(root);
	if (!s) die(t("hub.dir_not_a_hub", { name: root }));
	let report = checkHubSession(s);
	if (fix) {
		const autos = report.repos.flatMap((rp) => rp.checks.filter((c) => c.level === "fail" && c.fixFn).map((c) => ({ rp, c })));
		// Sin --yes y con terminal, se pregunta antes de cada arreglo; sin terminal o con
		// --yes, se aplican todos los seguros de una vez (como siempre).
		const ask = !yes && !json && process.stdin.isTTY === true;
		const p = ask ? await import("@clack/prompts") : undefined;
		// Con --json la stdout es solo el informe: los mensajes del arreglo van a stderr.
		const origLog = console.log;
		if (json) console.log = (...a: unknown[]) => console.error(...a); // eslint-disable-line no-console
		try {
			for (const { rp, c } of autos) {
				if (p) {
					const go = await p.confirm({ message: t("hub.check_prompt_fix", { check: c.check, repo: rp.repo, detail: c.detail ?? "" }) });
					if (typeof go === "symbol") {
						p.cancel(t("hub.cancelled"));
						process.exit(130);
					}
					if (!go) continue;
				}
				act(t("hub.check_act_fix", { check: c.check, repo: rp.repo, detail: c.detail ?? "" }), () => {
					try {
						c.fixFn!();
					} catch (e) {
						warn(t("hub.check_warn_fix_failed", { repo: rp.repo, check: c.check, error: (e as Error).message }));
					}
				});
			}
		} finally {
			if (json) console.log = origLog;
		}
		if (autos.length && !isDryRun()) report = checkHubSession(hubSession(s.root) ?? s);
	}
	if (json) console.log(hubCheckJson(report));
	else printCheck(report);
	if (report.level === "fail") process.exitCode = 1;
}
