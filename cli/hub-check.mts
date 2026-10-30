// bond hub check: revisa cada repo de la sesión del hub y dice qué falta y cómo arreglarlo:
// que existe y es un repo git, que su enlace es el que dice hub.toml, que tiene la base, que
// tiene bond init hecho y su config al día, que sus agentes están instalados, que admite
// worktrees y que no tiene cambios sin commitear ni una rama vertical a medias. Con --fix
// arregla solo lo seguro (enlazar con linkRepo, git submodule update --init); nunca descarta
// cambios ni cambia de rama un repo. Lo demás se ofrece con el comando a pasar.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { hubRepoLabel, hubRoot, hubSession, registerHubRepo, submodules, type HubRepo, type HubSession } from "./hub.mts";
import { linkRepo } from "./hub-init.mts";
import { agentInstalled } from "./catalog-agents.mts";
import { gitWorktrees } from "./team.mts";
import { loadRepoAgents, syncRepo } from "./repo.mts";
import { act, bad, brokenLink, canonical, catchDie, caution, die, dim, isDryRun, linkTarget, log, ok, run, setDryRun, warn } from "./util.mts";

export const HUB_CHECK_HELP = `Uso: bond hub check [opciones]

Revisa cada repo de la sesión del hub (el hub primero) y sale con 1 si algo no está
listo para trabajar con agentes. Cada problema nombra el repo, la comprobación y el
arreglo: existe y es un repo git, el enlace es el que dice hub.toml, la base existe,
bond init hecho y config al día, agentes instalados, admite worktrees, sin cambios
sin commitear y sin ramas verticales a medias.

Algunas comprobaciones son avisos (D17): se muestran con «!» pero no
cuentan como problemas ni cambian el código de salida (p. ej. los repos
fuera de repos/, la ruta por defecto desde D16, o una base atrasada
respecto a su remoto, D19).

  --fix     Arregla solo lo seguro: crea o repara el enlace al clon local (symlink,
            junction en Windows) y registra el repo en ~/.bond/hubs.toml (D14), e
            inicializa los submódulos sin iniciar. Nunca descarta cambios ni cambia
            de rama un repo. Con terminal y sin --yes pregunta antes de cada arreglo.
  --yes, -y Aplica los arreglos seguros sin preguntar (necesario sin terminal si se
            quiere arreglar; con --fix y terminal, evita la confirmación).
  --json    Salida en JSON (los mensajes del arreglo van a stderr).
  --dry-run Describe los arreglos sin aplicarlos.
`;

const git = (cwd: string, args: string[]) => run("git", ["-C", cwd, ...args]);
const firstLine = (s: string) => s.trim().split("\n")[0] ?? "";

export interface HubCheck {
	check: string;
	ok: boolean;
	detail?: string;
	fix?: string;
	/** Aviso (D17): se muestra pero no cuenta como problema ni cambia la salida. */
	warn?: boolean;
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
	/** Avisos (D17): no suman en problems ni cambian la salida. */
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
		check: "base atrasada",
		ok: true,
		warn: true,
		detail: `${behind} commit(s) por detrás de ${upstream}`,
		fix: "bond hub pull",
	}];
}

/** Aviso (D16/D17): un repo declarado fuera de repos/, la ruta por defecto de los hubs nuevos. */
function routeChecks(r: HubRepo): HubCheck[] {
	if (r.path === "." || r.path.startsWith("repos/")) return [];
	return [{
		check: "ruta",
		ok: true,
		warn: true,
		detail: `fuera de repos/ (la ruta por defecto es repos/<nombre>)`,
		fix: "si quieres la convención, mueve el repo a repos/<nombre> y actualiza su path en hub.toml",
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
				fixFn: () => fixLink(r, s),
			});
		} else if (existsSync(r.dir)) {
			checks.push({ check: "existe", ok: false, detail: "hay algo en su ruta que no es un repo git", fix: `revisa ${r.path}: ni repo ni enlace (${r.dir})` });
		} else {
			checks.push({
				check: "existe",
				ok: false,
				detail: `falta el enlace a ${r.source}`,
				fix: "bond hub check --fix",
				fixFn: () => fixLink(r, s),
			});
		}
		return checks;
	}

	// 2. El enlace es el que dice hub.toml (symlink y submódulo se reportan igual).
	if (r.link === "symlink") {
		const isLink = linkTarget(r.dir) !== undefined;
		if (!isLink) checks.push({ check: "enlace", ok: false, detail: 'es un directorio normal; en hub.toml link = "symlink"', fix: "enlaza la ruta al clon local o cambia link en hub.toml" });
		else if (r.source && canonical(r.dir) !== canonical(r.source)) checks.push({ check: "enlace", ok: false, detail: `apunta a ${canonical(r.dir)}, no al clon de .bond/hub.local.toml (${canonical(r.source)})`, fix: "recrea el enlace o corrige source en .bond/hub.local.toml" });
		else checks.push({ check: "enlace", ok: true, detail: `symlink -> ${canonical(r.dir)}` });
	} else if (r.link === "submodule") {
		checks.push(
			submodules(s.root).some((m) => m.path === r.path)
				? { check: "enlace", ok: true, detail: "submódulo" }
				: { check: "enlace", ok: false, detail: "no está registrado como submódulo del hub", fix: "bond hub add <url> o cambia link en hub.toml" },
		);
	}

	// 3. Tiene la base declarada.
	const hasBase = git(r.dir, ["rev-parse", "--verify", "--quiet", `${r.base}^{commit}`]).status === 0;
	checks.push(hasBase ? { check: "base", ok: true, detail: r.base } : { check: "base", ok: false, detail: `la base "${r.base}" no existe en ${name}`, fix: "cambia base en hub.toml o haz git fetch en el repo" });
	if (hasBase) checks.push(...baseBehindCheck(r));

	// 4. bond init hecho y config de agentes al día (bond sync --check).
	if (!existsSync(join(r.dir, ".bond", "bond.toml"))) {
		checks.push({ check: "bond init", ok: false, detail: "el repo no tiene .bond/bond.toml", fix: "bond hub sync (hace el bond init que falta)" });
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
	const hasAgent = opts.hasAgent ?? agentInstalled;
	const repos: RepoReport[] = s.repos.map((r) => {
		const checks = checkRepo(r, s, hasAgent);
		if (r.path === ".") checks.push(...verticalChecks(s));
		return { repo: hubRepoLabel(s, r), path: r.path, checks };
	});
	const problems = repos.reduce((n, rp) => n + rp.checks.filter((c) => !c.ok).length, 0);
	const warnings = repos.reduce((n, rp) => n + rp.checks.filter((c) => c.warn && c.ok).length, 0);
	return { hub: s.name, root: s.root, ok: problems === 0, problems, warnings, repos };
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
		const warned = rp.checks.filter((c) => c.warn && c.ok);
		if (!failed.length && !warned.length) {
			console.log(`  ${ok("✓")} ${rp.repo} ${dim(`(${rp.path})`)}`);
			continue;
		}
		console.log(`  ${failed.length ? bad("✗") : caution("!")} ${rp.repo} ${dim(`(${rp.path})`)}`);
		for (const c of failed) console.log(`      ${bad("✗")} ${c.check.padEnd(13)} ${c.detail ?? ""}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
		for (const c of warned) console.log(`      ${caution("!")} ${c.check.padEnd(13)} ${c.detail ?? ""}${c.fix ? dim(`  → ${c.fix}`) : ""}`);
	}
	const warnHint = r.warnings ? dim(` · ${r.warnings} aviso(s) que no impiden trabajar`) : "";
	console.log(r.ok ? `\n${ok("el hub está listo para trabajar con agentes")}${warnHint}` : `\n${bad(`${r.problems} problema(s)`)}` + dim(fixableHint(r)));
}

const fixableHint = (r: HubCheckReport) => (r.repos.some((rp) => rp.checks.some((c) => !c.ok && c.fixFn)) ? " → bond hub check --fix arregla lo seguro" : "");

export async function hubCheck(args: string[]): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(HUB_CHECK_HELP.trimEnd());
		return;
	}
	if (args.includes("--dry-run")) setDryRun(true);
	const fix = args.includes("--fix");
	const json = args.includes("--json");
	const yes = args.includes("--yes") || args.includes("-y");
	for (const a of args) if (!["--fix", "--json", "--dry-run", "--yes", "-y"].includes(a)) die(`opción desconocida: ${a} (bond hub check --help)`);
	const root = hubRoot(process.cwd());
	if (!root) die("no es un hub: falta hub.toml (bond hub --help)");
	const s = hubSession(root);
	if (!s) die(`${root} no es un hub: falta hub.toml`);
	let report = checkHubSession(s);
	if (fix) {
		const autos = report.repos.flatMap((rp) => rp.checks.filter((c) => !c.ok && c.fixFn).map((c) => ({ rp, c })));
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
					const go = await p.confirm({ message: `¿Arreglar ${c.check} en ${rp.repo}: ${c.detail ?? ""}?` });
					if (typeof go === "symbol") {
						p.cancel("Cancelado");
						process.exit(130);
					}
					if (!go) continue;
				}
				act(`arreglar ${c.check} en ${rp.repo}: ${c.detail ?? ""}`, () => {
					try {
						c.fixFn!();
					} catch (e) {
						warn(`${rp.repo}: no se pudo arreglar ${c.check}: ${(e as Error).message}`);
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
	if (!report.ok) process.exitCode = 1;
}
