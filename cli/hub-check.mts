// bond hub check: revisa cada repo de la sesión del hub y dice qué falta y cómo arreglarlo:
// que existe y es un repo git, que su enlace es el que dice hub.toml, que tiene la base, que
// tiene bond init hecho y su config al día, que sus agentes están instalados, que admite
// worktrees y que no tiene cambios sin commitear ni una rama vertical a medias. Con --fix
// arregla solo lo seguro (crear un enlace, git submodule update --init); nunca descarta
// cambios ni cambia de rama un repo. Lo demás se ofrece con el comando a pasar.

import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { hubRoot, hubSession, submodules, type HubRepo, type HubSession } from "./hub.mts";
import { gitWorktrees } from "./team.mts";
import { loadRepoAgents, syncRepo } from "./repo.mts";
import { agyLocalBin } from "./catalog-agents.mts";
import { act, bad, brokenLink, canonical, catchDie, die, dim, isDryRun, linkTarget, log, ok, run, warn, which } from "./util.mts";

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
const firstLine = (s: string) => s.trim().split("\n")[0] ?? "";

export interface HubCheck {
	check: string;
	ok: boolean;
	detail?: string;
	fix?: string;
	/** Cambio seguro que aplica --fix. No se incluye en --json. */
	fixFn?: () => void;
}

export interface RepoReport {
	repo: string;
	path: string;
	checks: HubCheck[];
}

export interface HubCheckReport {
	hub: string;
	root: string;
	ok: boolean;
	problems: number;
	repos: RepoReport[];
}

export interface CheckOpts {
	/** Sustituible en las pruebas: ¿está el agente instalado? */
	hasAgent?: (agent: string) => boolean;
}

const defaultHasAgent = (agent: string) => !!which(agent) || (agent === "agy" && existsSync(agyLocalBin()));

const label = (s: HubSession, r: HubRepo) => (r.path === "." ? s.name : r.path);

/** Enlace de directorio: symlink y, en Windows sin permisos, junction (D15). */
function makeDirLink(src: string, dest: string): void {
	mkdirSync(dirname(dest), { recursive: true });
	try {
		symlinkSync(src, dest);
		log(`enlazado: ${dest} -> ${src}`);
	} catch (e) {
		if (process.platform !== "win32") throw e;
		const j = run("cmd", ["/c", "mklink", "/J", dest, src]);
		if (j.status !== 0) throw e;
		log(`junction: ${dest} -> ${src}`);
	}
}

/** Las comprobaciones de un repo de la sesión. Si no está en disco, solo se reporta eso. */
function checkRepo(r: HubRepo, s: HubSession, hasAgent: (agent: string) => boolean): HubCheck[] {
	const name = label(s, r);
	const checks: HubCheck[] = [];

	// 1. Existe y es un repo git.
	if (!r.present) {
		if (r.link === "submodule") {
			checks.push({
				check: "existe",
				ok: false,
				detail: "submódulo sin inicializar",
				fix: `bond hub check --fix (git -C ${s.root} submodule update --init ${r.path})`,
				fixFn: () => {
					const g = git(s.root, ["submodule", "update", "--init", "--", r.path]);
					if (g.status !== 0) warn(`${name}: git submodule update --init: ${firstLine(g.stderr)}`);
					else log(`${name}: submódulo inicializado`);
				},
			});
		} else if (!r.source) {
			checks.push({ check: "existe", ok: false, detail: "falta el enlace y no hay clon local declarado", fix: "añade source a [repos.<x>] en .bond/hub.local.toml" });
		} else if (!existsSync(r.source)) {
			checks.push({ check: "existe", ok: false, detail: `falta el enlace y el clon local ${r.source} no existe`, fix: "restaura el clon o cambia source en .bond/hub.local.toml" });
		} else if (brokenLink(r.dir)) {
			checks.push({
				check: "existe",
				ok: false,
				detail: `el enlace está roto (apuntaba a ${linkTarget(r.dir)})`,
				fix: "bond hub check --fix",
				fixFn: () => {
					rmSync(r.dir);
					makeDirLink(r.source!, r.dir);
				},
			});
		} else if (existsSync(r.dir)) {
			checks.push({ check: "existe", ok: false, detail: "hay algo en su ruta que no es un repo git", fix: `revisa ${r.path}: ni repo ni enlace (${r.dir})` });
		} else {
			checks.push({
				check: "existe",
				ok: false,
				detail: `falta el enlace a ${r.source}`,
				fix: "bond hub check --fix",
				fixFn: () => makeDirLink(r.source!, r.dir),
			});
		}
		return checks;
	}

	// 2. El enlace es el que dice hub.toml.
	if (r.link === "symlink") {
		const isLink = linkTarget(r.dir) !== undefined;
		if (!isLink) checks.push({ check: "enlace", ok: false, detail: 'es un directorio normal; en hub.toml link = "symlink"', fix: "enlaza la ruta al clon local o cambia link en hub.toml" });
		else if (r.source && canonical(r.dir) !== canonical(r.source)) checks.push({ check: "enlace", ok: false, detail: `apunta a ${canonical(r.dir)}, no al clon de .bond/hub.local.toml (${canonical(r.source)})`, fix: "recrea el enlace o corrige source en .bond/hub.local.toml" });
		else checks.push({ check: "enlace", ok: true, detail: `symlink -> ${canonical(r.dir)}` });
	} else if (r.link === "submodule" && !submodules(s.root).some((m) => m.path === r.path)) {
		checks.push({ check: "enlace", ok: false, detail: "no está registrado como submódulo del hub", fix: "bond hub add <url> o cambia link en hub.toml" });
	}

	// 3. Tiene la base declarada.
	const hasBase = git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status === 0;
	checks.push(hasBase ? { check: "base", ok: true, detail: r.base } : { check: "base", ok: false, detail: `la base "${r.base}" no existe en ${name}`, fix: "cambia base en hub.toml o haz git fetch en el repo" });

	// 4. bond init hecho y config de agentes al día (bond sync --check).
	if (!existsSync(join(r.dir, ".bond", "bond.toml"))) {
		checks.push({ check: "bond init", ok: false, detail: "el repo no tiene .bond/bond.toml", fix: `bond init (en ${r.dir})` });
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
		if (cfgError !== undefined) checks.push({ check: "config", ok: false, detail: cfgError, fix: `bond sync (en ${r.dir})` });
		else if (cfgActions && cfgActions.length) checks.push({ check: "config", ok: false, detail: `${cfgActions.length} cambio(s) de config de agente pendientes`, fix: `bond sync (en ${r.dir})` });
		else checks.push({ check: "config", ok: true, detail: "al día" });

		// 5. Sus agentes están instalados (los de su bond.toml y el agent de hub.toml).
		const agents = catchDie(() => loadRepoAgents(r.dir));
		if (agents.error !== undefined) checks.push({ check: "agentes", ok: false, detail: agents.error, fix: "revisa .bond/bond.toml" });
		else {
			const wanted = [...new Set([...agents.value.agents, ...(r.agent ? [r.agent] : [])])];
			const missing = wanted.filter((a) => !hasAgent(a));
			checks.push(missing.length ? { check: "agentes", ok: false, detail: `no están instalados: ${missing.join(", ")}`, fix: "bond setup, o instala el agente y repite bond hub check" } : { check: "agentes", ok: true, detail: wanted.length ? wanted.join(", ") : "sin agentes" });
		}
	}

	// 6. Admite worktrees (bond team trabaja con worktrees).
	const bare = git(r.dir, ["rev-parse", "--is-bare-repository"]).stdout.trim() === "true";
	const wt = !bare && git(r.dir, ["worktree", "list", "--porcelain"]).status === 0;
	checks.push(wt ? { check: "worktrees", ok: true } : { check: "worktrees", ok: false, detail: bare ? "el repo es bare: bond team no puede crear worktrees en él" : `git worktree list falla en ${name}`, fix: bare ? "importa un clon normal (git clone) y enlázalo" : undefined });

	// 7. Sin cambios sin commitear (bond team sale de lo commiteado).
	const dirty = git(r.dir, ["status", "--porcelain"]).stdout.split("\n").filter(Boolean).length;
	checks.push(dirty ? { check: "cambios", ok: false, detail: `${dirty} cambio(s) sin commitear`, fix: "commitea o guarda los cambios: el worktree de bond team sale de lo commiteado" } : { check: "cambios", ok: true, detail: "limpio" });

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
			checks.push({ check: "rama vertical", ok: false, detail: `${branch} tiene worktree en ${byBranch.get(branch)!.join(", ")} pero no existe en el hub`, fix: `bond team clean ${branch}, o crea la rama en el hub antes de abrir worktrees` });
		}
	}
	if (branches.length > 1) checks.push({ check: "rama vertical", ok: false, detail: `varias ramas verticales abiertas (${branches.join(", ")}): en un hub solo cabe una por sesión`, fix: `bond team clean ${branches[0]} (las ramas se quedan)` });
	if (!checks.length) checks.push({ check: "rama vertical", ok: true, detail: branches.length === 1 ? `${branches[0]} en la sesión` : "ninguna abierta" });
	return checks;
}

/** El informe completo de la sesión: una fila de comprobaciones por repo. */
export function checkHubSession(s: HubSession, opts: CheckOpts = {}): HubCheckReport {
	const hasAgent = opts.hasAgent ?? defaultHasAgent;
	const repos: RepoReport[] = s.repos.map((r) => {
		const checks = checkRepo(r, s, hasAgent);
		if (r.path === ".") checks.push(...verticalChecks(s));
		return { repo: label(s, r), path: r.path, checks };
	});
	const problems = repos.reduce((n, rp) => n + rp.checks.filter((c) => !c.ok).length, 0);
	return { hub: s.name, root: s.root, ok: problems === 0, problems, repos };
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
		const failed = rp.checks.filter((c) => !c.ok);
		if (!failed.length) {
			console.log(`  ${ok("✓")} ${rp.repo} ${dim(`(${rp.path})`)}`);
			continue;
		}
		console.log(`  ${bad("✗")} ${rp.repo} ${dim(`(${rp.path})`)}`);
		for (const c of failed) console.log(`      ${bad("✗")} ${c.check.padEnd(13)} ${c.detail ?? ""}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
	}
	console.log(r.ok ? `\n${ok("el hub está listo para trabajar con agentes")}` : `\n${bad(`${r.problems} problema(s)`)}${dim(fixableHint(r))}`);
}

const fixableHint = (r: HubCheckReport) => (r.repos.some((rp) => rp.checks.some((c) => !c.ok && c.fixFn)) ? " → bond hub check --fix arregla lo seguro" : "");

export function hubCheck(args: string[]): void {
	const fix = args.includes("--fix");
	const json = args.includes("--json");
	for (const a of args) if (!["--fix", "--json", "--dry-run"].includes(a)) die(`opción desconocida: ${a} (bond hub check --help)`);
	const root = hubRoot(process.cwd());
	if (!root) die("no es un hub: falta hub.toml (bond hub --help)");
	const s = hubSession(root);
	if (!s) die(`${root} no es un hub: falta hub.toml`);
	let report = checkHubSession(s);
	if (fix) {
		const autos = report.repos.flatMap((rp) => rp.checks.filter((c) => !c.ok && c.fixFn).map((c) => ({ rp, c })));
		for (const { rp, c } of autos) {
			act(`arreglar ${c.check} en ${rp.repo}: ${c.detail ?? ""}`, () => {
				try {
					c.fixFn!();
				} catch (e) {
					warn(`${rp.repo}: no se pudo arreglar ${c.check}: ${(e as Error).message}`);
				}
			});
		}
		if (autos.length && !isDryRun()) report = checkHubSession(hubSession(s.root) ?? s);
	}
	if (json) console.log(hubCheckJson(report));
	else printCheck(report);
	if (!report.ok) process.exitCode = 1;
}
