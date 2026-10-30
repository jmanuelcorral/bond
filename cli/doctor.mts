// `bond doctor`: comprueba que la máquina está como la deja `bond setup` y que lo que depende
// de fuera (Herdr, MCP, la pasarela de modelos) responde. Sale con 1 si algo falla.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";
import type { UpdateState } from "./config.mts";
import { enabledModelsCover } from "./suggestions.mts";
import { assetsPath, BOND_HOME, FROM_SOURCE, installedRuntime, VERSION } from "./runtime.mts";
import { compareVersions, installMethod } from "./update.mts";
import { AGY_PLUGIN_JSON, CONTEXT_TOOLS, globalSkillsDir, globalSkillTargets, herdrIntegrationStatus, herdrSkillDir, integrationsFor, PI_HERDR_SKILL, SHARED_HERDR_SKILL } from "./setup.mts";
import { agentInfo, agyLocalBin, agyPluginDir } from "./catalog-agents.mts";
import { AGENT_DIR, bad, catchDie, caution, die, dim, HOME, isCopyOf, linkTarget, ok, REPO_DIR, run, samePath, which } from "./util.mts";

/** Skill global en su sitio: enlazado (o, en Windows, copiado) desde bond. */
const installedSkill = (src: string, dest: string) => (process.platform === "win32" ? isCopyOf(src, dest) : !!linkTarget(dest) && samePath(dest, src));

export const DOCTOR_HELP = `Uso: bond doctor [--quick]

Comprueba la instalación global: Node, Herdr, pi, Antigravity (agy, si lo usas), enlaces de
configuración, paquete de pi, skill de Herdr, integración, filtro de git, herramientas de
contexto, servidores MCP, la pasarela de modelos, las sugerencias de prompt de pi, los
catálogos del repo, la sesión del hub si estás en uno (resumen de bond hub check), la
memoria de decisiones (si el repo tiene [decisions]) y el aviso de versión nueva. Sale con 1
si algo falla.

  --quick      Se salta lo lento (conectar los servidores MCP, consultar las refs de los
               catálogos por git)
  -h, --help   Esta ayuda`;

type Level = "ok" | "warn" | "fail";
export interface Check {
	level: Level;
	name: string;
	detail: string;
	fix?: string;
}

const results: Check[] = [];
/** Agentes elegidos en `bond setup` (vacío: todavía no hay configuración). */
let chosen: string[] = [];
const add = (level: Level | Check, name?: string, detail?: string, fix?: string): void => {
	results.push(typeof level === "string" ? { level, name: name ?? "", detail: detail ?? "", fix } : level);
};

function checkConfig(): void {
	if (!chosen.length) return add("warn", "agentes", "sin elegir todavía", "bond setup");
	add("ok", "agentes", chosen.join(", "));
	// Claves: carpeta 700 y ficheros 600 (en Windows no aplica).
	const keys = join(BOND_HOME, "keys");
	if (process.platform === "win32" || !existsSync(keys)) return;
	const loose = [keys, ...readdirSync(keys).map((f) => join(keys, f))].filter((f) => (statSync(f).mode & 0o077) !== 0);
	if (loose.length) add("fail", "claves", `permisos demasiado abiertos: ${loose.join(", ")}`, "chmod 700 ~/.bond/keys && chmod 600 ~/.bond/keys/*");
	else add("ok", "claves", "~/.bond/keys con permisos 600");
}

function checkNode(): void {
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (major > 22 || (major === 22 && minor >= 18)) add("ok", "node", process.versions.node);
	else add("fail", "node", `${process.versions.node}: hace falta 22.18 o más (TypeScript sin compilar)`);
}

function checkHerdr(): void {
	if (!which("herdr")) return add("fail", "herdr", "no está en el PATH", "https://herdr.dev/docs/install/");
	const status = run("herdr", ["status"]).stdout;
	const client = /client:[\s\S]*?version: (\S+)/.exec(status)?.[1] ?? "?";
	const running = /server:[\s\S]*?status: running/.test(status);
	add(running ? "ok" : "warn", "herdr", `${client}${running ? ", servidor en marcha" : ", servidor parado"}`, running ? undefined : "herdr (lo arranca)");
	// Integración de Herdr de cada agente instalado: pi es obligatoria; las demás, aviso.
	const states = integrationsFor(herdrIntegrationStatus(), chosen);
	const current = states.filter((s) => s.state.startsWith("current")).map((s) => s.integration);
	if (current.length) add("ok", "integraciones herdr", current.join(", "));
	for (const s of states.filter((x) => !x.state.startsWith("current"))) {
		add(s.agent === "pi" ? "fail" : "warn", `integración herdr-${s.integration}`, s.state, "bond setup");
	}
}

function checkPi(): void {
	if (chosen.length && !chosen.includes("pi")) return; // pi no es uno de tus agentes
	if (!which("pi")) return add("fail", "pi", "no está en el PATH", "bond setup");
	add("ok", "pi", run("pi", ["--version"]).stdout.trim());
	// Restos de bond 0.7: config de pi enlazada al repo o el repo como paquete global.
	const legacy = ["settings.json", "AGENTS.md", "mcp.json", "bond", "pisetup", "prompts"].filter((f) => linkTarget(join(AGENT_DIR, f)) !== undefined);
	if (legacy.length) add("warn", "instalación anterior", `enlaces en ~/.pi/agent: ${legacy.join(", ")}`, "bond migrate");
	// Bond Extensions: ~/.bond/pi tiene que apuntar a la versión instalada. Desde el repo
	// (desarrollo), un enlace a un runtime instalado válido es aviso: pi usa las extensiones
	// de esa versión, no las del repo.
	const link = join(BOND_HOME, "pi");
	const target = linkTarget(link);
	if (!target) add("warn", "Bond Extensions", "falta ~/.bond/pi", "bond setup");
	else if (samePath(link, assetsPath())) add("ok", "Bond Extensions", `~/.bond/pi -> ${FROM_SOURCE ? "repo" : "runtime"}`);
	else {
		const runtime = FROM_SOURCE ? installedRuntime(target) : undefined;
		if (runtime) add("warn", "Bond Extensions", `~/.bond/pi apunta al runtime ${runtime}: pi usa las extensiones instaladas, no las del repo`, "bond setup");
		else add("fail", "Bond Extensions", "~/.bond/pi apunta a otra versión de bond", "bond setup");
	}
}

/**
 * Fila de Antigravity: su versión si `agy` está en el PATH. Su instalador lo deja en
 * ~/.local/bin, que no siempre está en el PATH de las shells no interactivas (Herdr, bond
 * team): si está ahí pero no en el PATH, avisa de eso y no de que falte.
 */
export function agyCheck(o: { path?: string; version?: string; local?: string }): Check {
	if (o.path) return { level: "ok", name: "agy", detail: o.version ?? "?" };
	if (o.local) return { level: "warn", name: "agy", detail: `está en ${o.local}, pero no en el PATH (bond team lo encuentra; Herdr y otras herramientas no)`, fix: `añade ${dirname(o.local)} al PATH también de las shells no interactivas (p. ej. en ~/.profile)` };
	return { level: "warn", name: "agy", detail: "no está instalado", fix: agentInfo("agy")?.install };
}

async function checkAgy(): Promise<void> {
	// Solo si es uno de tus agentes, de los del repo o, sin bond setup, si está instalado.
	const path = which("agy");
	const installer = agyLocalBin();
	const local = existsSync(installer) ? installer : undefined;
	const mine = chosen.includes("agy") || (!chosen.length && !!(path || local));
	if (!mine && !(await repoAgents()).includes("agy")) return;
	const version = path ? /\d+\.\d+(?:\.\d+)?/.exec(run("agy", ["--version"], { timeout: 15_000 }).stdout)?.[0] : undefined;
	add(agyCheck({ path, version, local }));
}

/** Agentes del bond.toml del repo actual (ninguno fuera de un repo con bond o si no se lee). */
async function repoAgents(): Promise<string[]> {
	const top = run("git", ["rev-parse", "--show-toplevel"]);
	const root = top.status === 0 ? top.stdout.trim() : process.cwd();
	if (!existsSync(join(root, ".bond", "bond.toml")) || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return [];
	const { loadRepoAgents } = await import("./repo.mts");
	return catchDie(() => loadRepoAgents(root)).value?.agents ?? [];
}

function checkHerdrSkill(): void {
	const shared = existsSync(SHARED_HERDR_SKILL);
	const mine = existsSync(PI_HERDR_SKILL);
	if (shared && mine) return add("fail", "skill herdr", "duplicado en ~/.agents/skills y ~/.pi/agent/skills", "bond setup");
	if (!shared && !mine) return add("fail", "skill herdr", "no está instalado", "bond setup");
	const file = shared ? SHARED_HERDR_SKILL : PI_HERDR_SKILL;
	const fresh = which("herdr") ? run("herdr", ["--skill"]).stdout.trimEnd() : "";
	if (fresh && readFileSync(file, "utf8").trimEnd() !== fresh) {
		add("warn", "skill herdr", `${shared ? "compartido" : "de pi"}, desfasado respecto a 'herdr --skill'`, shared ? "npx skills update herdr" : "bond setup");
	} else add("ok", "skill herdr", shared ? "compartido (~/.agents/skills)" : "de pi");
}

function checkGlobalSkills(): void {
	const missing: string[] = [];
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name, false)) if (!installedSkill(join(globalSkillsDir(), name), dest)) missing.push(dest.replace(process.env.HOME ?? "", "~"));
	}
	if (missing.length) add("fail", "skills globales", `faltan: ${missing.join(", ")}`, "bond setup");
	else add("ok", "skills globales", `${readdirSync(globalSkillsDir()).join(", ")} (~/.agents/skills, ~/.claude/skills)`);
}

/** Fila del plugin global de bond para agy: manifiesto, reglas al día y skills enlazadas. */
export function agyPluginCheck(o: { manifest: boolean; rules: boolean; skills: string[]; missing: string[] }): Check {
	const problems = [...(o.manifest ? [] : ["falta plugin.json"]), ...(o.rules ? [] : ["reglas desfasadas o sin escribir"]), ...(o.missing.length ? [`faltan skills: ${o.missing.join(", ")}`] : [])];
	if (problems.length) return { level: "fail", name: "plugin agy", detail: problems.join("; "), fix: "bond setup" };
	return { level: "ok", name: "plugin agy", detail: `reglas y skills al día (${o.skills.join(", ")})` };
}

async function checkAgyPlugin(): Promise<void> {
	// Solo si agy es uno de tus agentes: bond setup crea el plugin en ~/.gemini/config/plugins/bond.
	// Sin dependencias no se puede leer el bloque (lo dice la fila de dependencias).
	if (!chosen.includes("agy") || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return;
	const { blockCurrent } = await import("./instructions.mts");
	const dir = agyPluginDir();
	const manifest = join(dir, "plugin.json");
	const skills: Array<[string, string]> = readdirSync(globalSkillsDir()).map((n) => [n, join(globalSkillsDir(), n)]);
	const herdr = herdrSkillDir();
	if (herdr) skills.push(["herdr", herdr]);
	add(
		agyPluginCheck({
			manifest: existsSync(manifest) && readFileSync(manifest, "utf8") === AGY_PLUGIN_JSON,
			rules: blockCurrent(join(dir, "rules", "AGENTS.md")),
			skills: skills.map(([n]) => n),
			missing: skills.filter(([n, src]) => !installedSkill(src, join(dir, "skills", n))).map(([n]) => n),
		}),
	);
}

function checkTools(): void {
	const missing = CONTEXT_TOOLS.filter(([c]) => !which(c));
	if (missing.length === 0) add("ok", "herramientas", CONTEXT_TOOLS.map(([c]) => c).join(" "));
	for (const [c, why] of missing) add("warn", `herramienta ${c}`, `falta (${why})`);
}

function checkMcp(): void {
	if (!which("pi")) return;
	const r = run("pi", ["mcp", "list"], { timeout: 120_000 });
	for (const m of r.stdout.matchAll(/^(\S+): (connected|[^\n]+)$/gm)) {
		const [, name, state] = m;
		add(state.startsWith("connected") ? "ok" : "fail", `mcp ${name}`, state, state.startsWith("connected") ? undefined : "pi mcp list");
	}
	if (r.status !== 0 && !/connected/.test(r.stdout)) add("fail", "mcp", r.stderr.trim().split("\n")[0] || "pi mcp list falló");
}

/** Registro global de modelos: config, sincronía con cada agente y que las pasarelas respondan. */
async function checkModels(): Promise<void> {
	if (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) {
		return add("fail", "dependencias", "falta node_modules (smol-toml)", "bond setup");
	}
	const { CONFIG_FILE, activeProviders, loadConfig } = await import("./config.mts");
	if (!existsSync(CONFIG_FILE)) return add("fail", "configuración", `no existe ${CONFIG_FILE}`, "bond setup");
	const { syncAgents } = await import("./models.mts");
	const withModels = ["pi", "opencode", "crush", "codex"].filter((a) => !chosen.length || chosen.includes(a));
	const stale = withModels.length && activeProviders(loadConfig()).length ? syncAgents({ check: true, quiet: true, agents: withModels.filter((a) => which(a)) }) : [];
	if (withModels.includes("pi") && which("pi")) {
		if (stale.includes("pi")) add("fail", "modelos pi", "desfasado respecto a config.toml", "bond models sync --agent pi");
		else add("ok", "modelos pi", "al día con config.toml");
	}
	const others = stale.filter((a) => a !== "pi");
	if (others.length) add("warn", "modelos otros agentes", `desfasados: ${others.join(", ")}`, "bond models sync");

	for (const p of activeProviders(loadConfig())) {
		try {
			const { readKey } = await import("./keys.mts");
			const key = p.key_stored ? readKey(p.id) : p.api_key_env ? process.env[p.api_key_env] : undefined;
			const res = await fetch(`${p.base_url.replace(/\/$/, "")}/models`, {
				headers: key ? { authorization: `Bearer ${key}` } : {},
				signal: AbortSignal.timeout(10_000),
			});
			const served = new Set(((await res.json()) as { data?: Array<{ id: string }> }).data?.map((m) => m.id) ?? []);
			const declared = p.models.map((m) => m.id);
			const missing = declared.filter((m) => !served.has(m));
			if (missing.length) add("warn", `pasarela ${p.id}`, `no lista: ${missing.join(", ")}`);
			else add("ok", `pasarela ${p.id}`, `${p.base_url} sirve ${declared.join(", ")}`);
		} catch (e) {
			add("fail", `pasarela ${p.id}`, `${p.base_url} no responde (${(e as Error).message})`);
		}
	}
}

/** Si se ejecuta dentro de un repo con .bond/, comprueba que su config de agentes está al día. */
async function checkRepo(): Promise<void> {
	const top = run("git", ["rev-parse", "--show-toplevel"]);
	const root = top.status === 0 ? top.stdout.trim() : process.cwd();
	if (!existsSync(join(root, ".bond", "bond.toml")) || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return;
	const { syncRepo } = await import("./repo.mts");
	// Un bond.toml, un lock o un catálogo que no valen hacen morir a sync: aquí son una fila más.
	const { value: actions, error } = catchDie(() => syncRepo({ check: true, quiet: true }));
	if (error !== undefined) return add("fail", "repo", `${root}: ${error}`, /\bbond \w+/.test(error) ? undefined : "bond sync");
	const conflicts = actions.filter((a) => a.sign === "!").length;
	if (!actions.length) add("ok", "repo", `${root}: config de agentes al día`);
	else add(conflicts ? "fail" : "warn", "repo", `${root}: ${actions.length} cambio(s) pendiente(s)${conflicts ? `, ${conflicts} conflicto(s)` : ""}`, "bond sync");
}

/**
 * Resumen de `bond hub check` cuando el directorio actual está en un hub: una sola fila.
 * Fuera de un hub no añade nada. El detalle lo da `bond hub check`.
 */
async function checkHubRow(): Promise<void> {
	const { hubRoot, hubSession, repoChain } = await import("./hub.mts");
	const cwd = process.cwd();
	const root = hubRoot(cwd);
	if (!root) {
		// Un hub.toml inválido hace que hubRoot descarte el repo; en doctor eso es un fallo,
		// no un silencio: se reporta con el error de parseo.
		const bad = repoChain(cwd).find((d) => existsSync(join(d, "hub.toml")));
		if (!bad) return;
		const b = catchDie(() => hubSession(bad));
		if (b.error !== undefined) add("fail", "hub", `hub.toml inválido: ${b.error}`, "corrige hub.toml (bond hub --help)");
		return;
	}
	const s = catchDie(() => hubSession(root));
	if (s.error !== undefined) return add("fail", "hub", `hub.toml inválido: ${s.error}`, "corrige hub.toml (bond hub --help)");
	if (!s.value) return;
	const { checkHubSession } = await import("./hub-check.mts");
	const r = catchDie(() => checkHubSession(s.value!));
	if (r.error !== undefined) return add("fail", `hub ${s.value.name}`, r.error, "bond hub check");
	const failed = r.value.repos.flatMap((rp) => rp.checks.filter((c) => !c.ok).map((c) => `${rp.repo} · ${c.check}`));
	const warned = r.value.repos.flatMap((rp) => rp.checks.filter((c) => c.warn && c.ok).map((c) => `${rp.repo} · ${c.check}`));
	if (failed.length) add("fail", `hub ${r.value.hub}`, `${failed.length} problema(s): ${failed.join("; ")}`, "bond hub check");
	// D17: los avisos del hub se reflejan sin pasar la fila a fallo.
	else if (warned.length) add("warn", `hub ${r.value.hub}`, `${warned.length} aviso(s): ${warned.join("; ")}`, "bond hub check");
	else add("ok", `hub ${r.value.hub}`, `${r.value.repos.length - 1} repo(s) de la sesión al día`);
}

/**
 * Estado de un catálogo del repo ([[catalog]] en bond.toml) para su fila en `bond doctor`.
 * Lo construye checkCatalogs() sin descargar nada; `verified`/`remoteSha` vienen de consultar
 * la ref por la red, cosa que solo se hace sin `--quick`.
 */
export interface CatalogStatus {
	name: string;
	kind: "git" | "local";
	/** De dónde viene: la URL (el git de bond.toml) o la carpeta declarada. */
	where: string;
	/** La ref declarada (git). */
	ref?: string;
	/** Commit fijado en .bond/lock.json (git). */
	sha?: string;
	/** Está descargado en ~/.bond/catalogs (git). */
	cached?: boolean;
	/** Commit actual de la ref, si se pudo consultar la red. */
	remoteSha?: string;
	/** Se consultó la ref. false con --quick o si no se pudo leer: «sin verificar». */
	verified: boolean;
	/** Algo que impide usar el catálogo (lock que falta o no cuadra, carpeta inexistente). */
	error?: string;
}

/** Fila de un catálogo del equipo: commit fijado, caché y si la ref tiene algo más nuevo. */
export function catalogCheck(s: CatalogStatus): Check {
	const name = `catálogo ${s.name}`;
	if (s.error) return { level: "fail", name, detail: s.error, fix: s.kind === "git" ? `bond catalog update ${s.name}` : undefined };
	if (s.kind === "local") return { level: "ok", name, detail: `carpeta ${s.where}` };
	const parts = [`${s.sha?.slice(0, 7)}${s.cached ? " en caché" : " sin descargar (bond sync la baja)"}`];
	if (!s.verified) parts.push("sin verificar");
	else if (s.remoteSha === s.sha) parts.push(`al día (${s.ref ?? "rama por defecto"})`);
	else return { level: "warn", name, detail: `${parts.join(" · ")} · hay un commit más nuevo en ${s.ref ?? "la ref"}: ${s.remoteSha?.slice(0, 7)}`, fix: `bond catalog update ${s.name}` };
	return { level: "ok", name, detail: parts.join(" · ") };
}

/**
 * Una fila por catálogo del repo (bond.toml [[catalog]]): commit fijado, caché y, si hay red,
 * si la ref tiene un commit más nuevo. No descarga nada: lee bond.toml y el lock tal cual
 * están; con `--quick` no consulta la red («sin verificar»). Fuera de un repo con bond, no
 * dice nada.
 */
async function checkCatalogs(quick: boolean): Promise<void> {
	const top = run("git", ["rev-parse", "--show-toplevel"]);
	const root = top.status === 0 ? top.stdout.trim() : process.cwd();
	const file = join(root, ".bond", "bond.toml");
	if (!existsSync(file) || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return;
	const { parse } = await import("smol-toml");
	let raw: Record<string, unknown>;
	try {
		raw = parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		return; // bond.toml inválido: checkRepo lo cuenta antes que esto.
	}
	const decl = (Array.isArray(raw.catalog) ? raw.catalog : []) as Array<Record<string, unknown>>;
	if (!decl.length) return;
	const { cacheDir, gitKey, probeRef, readLockSafe } = await import("./catalog-git.mts");
	const { catalogSlug } = await import("./catalog.mts");
	const { lock, error: lockError } = readLockSafe(root);
	const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
	for (const entry of decl) {
		const path = text(entry?.path);
		const url = text(entry?.git);
		if (url) {
			const name = text(entry?.name) ?? catalogSlug(basename(gitKey(url)));
			if (!text(entry?.name)) {
				add("fail", `catálogo ${name}`, "un catálogo por git necesita name en bond.toml (es su clave en el lock)", "bond catalog update");
				continue;
			}
			if (lockError) {
				add("fail", `catálogo ${name}`, `.bond/lock.json no se puede leer (${lockError})`, "bond catalog update");
				continue;
			}
			const ref = text(entry?.ref);
			const locked = lock!.catalogs[name];
			if (!locked) {
				add("fail", `catálogo ${name}`, `${url} no está fijado en .bond/lock.json`, `bond catalog update ${name}`);
				continue;
			}
			if (gitKey(locked.git) !== gitKey(url) || (locked.ref ?? "") !== (ref ?? "")) {
				add("fail", `catálogo ${name}`, ".bond/lock.json fija este catálogo para otra URL o ref", `bond catalog update ${name}`);
				continue;
			}
			const remoteSha = quick ? undefined : probeRef(url, ref);
			add(catalogCheck({ name, kind: "git", where: url, ref, sha: locked.sha, cached: existsSync(cacheDir(url, locked.sha)), remoteSha, verified: remoteSha !== undefined }));
		} else if (path) {
			const dir = resolve(root, path);
			let name = text(entry?.name);
			if (!name) {
				try {
					name = text((parse(readFileSync(join(dir, "catalog.toml"), "utf8")) as Record<string, unknown>).name);
				} catch {
					// Sin catalog.toml legible: se nombra por la carpeta, como hace el aviso.
				}
				name = name ?? catalogSlug(basename(dir));
			}
			if (!existsSync(dir) || !statSync(dir).isDirectory()) add("fail", `catálogo ${name}`, `no existe la carpeta ${path}`, "bond catalog add <carpeta>");
			else add(catalogCheck({ name, kind: "local", where: path, verified: true }));
		} else add("fail", "catálogo", "un [[catalog]] de bond.toml no tiene ni path ni git", "bond catalog add <url|carpeta>");
	}
}

/**
 * Fila de la memoria de decisiones: errores de `bond decisions check` y propuestas
 * pendientes de aceptación. Sin la sección [decisions] en el repo, no muestra fila.
 */
async function checkDecisionsRow(): Promise<void> {
	const top = run("git", ["rev-parse", "--show-toplevel"]);
	const root = top.status === 0 ? top.stdout.trim() : process.cwd();
	if (!existsSync(join(root, ".bond", "bond.toml")) || (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml")))) return;
	const { decisionsDoctor } = await import("./decisions.mts");
	const r = decisionsDoctor(root);
	if (r) add(r);
}

function checkBond(): void {
	const p = which("bond");
	if (!FROM_SOURCE) return add(p ? "ok" : "warn", "bond en el PATH", p ?? "no está (instálalo con tu gestor de paquetes)");
	if (p && samePath(p, join(REPO_DIR, "bin", "bond"))) add("ok", "bond en el PATH", p);
	else if (p) add("warn", "bond en el PATH", `${p} no es el de este repo`);
	else add("warn", "bond en el PATH", "no está", "bond setup");
}

const METHODS = { binary: "binario", brew: "Homebrew", npm: "npm", source: "desde el código" } as const;

/**
 * Fila de actualizaciones: método de instalación, última consulta, versión pendiente, omitida y
 * si se pregunta al arrancar. Informa sin fallar: no haber mirado nunca no es un error.
 */
export function updateCheck(o: { method: keyof typeof METHODS; state?: UpdateState; auto: boolean; disabled?: boolean; version?: string }): Check {
	const version = o.version ?? VERSION;
	const { checkedAt, latest, skipped } = o.state ?? {};
	const when = checkedAt && !Number.isNaN(Date.parse(checkedAt)) ? `${checkedAt.slice(0, 16).replace("T", " ")} UTC` : undefined;
	const pending = latest && compareVersions(latest, version) > 0 ? latest.slice(1) : undefined;
	const ask = o.disabled ? "desactivado (BOND_NO_UPDATE=1)" : o.auto ? "sí" : "no ([update] auto = false)";
	const detail = [
		METHODS[o.method],
		`última comprobación: ${when ?? "nunca"}`,
		`pendiente: ${pending ?? "ninguna"}`,
		`omitida: ${skipped?.slice(1) ?? "ninguna"}`,
		`aviso al arrancar: ${ask}`,
	].join(" · ");
	// Pendiente y no omitida: aviso, con el comando. Lo demás es informativo.
	if (pending && skipped !== latest) return { level: "warn", name: "actualizaciones", detail, fix: "bond update" };
	return { level: "ok", name: "actualizaciones", detail };
}

export interface SuggestionsState {
	/** [suggestions] enabled (por defecto, true). */
	enabled: boolean;
	/** [suggestions] model, si se puso a mano. */
	configuredModel?: string;
	/** Lo que resuelve la heurística de bond cuando no hay modelo explícito. */
	resolvedModel?: string;
	/** El modelo que tiene puesto la extensión en su config (supi). */
	supiModel?: string;
	/** El paquete está declarado en la config de pi. */
	installed: boolean;
	/** enabledModels de pi, tal cual está en su settings.json. */
	enabledModels?: unknown;
	/** Otras extensiones locales que también reemplazan el editor. */
	otherEditors?: string[];
}

/**
 * Fila de sugerencias de prompt: modelo elegido, si el paquete está, si el config de la
 * extensión coincide y si enabledModels de pi deja pasar ese modelo. Solo avisos: es una
 * comodidad, no una pieza que rompa la instalación.
 */
export function suggestionsCheck(s: SuggestionsState): Check {
	const model = s.configuredModel ?? s.resolvedModel;
	if (!s.enabled) return { level: "ok", name: "sugerencias", detail: "desactivadas ([suggestions] enabled = false)", fix: "bond setup" };
	if (!model) return { level: "warn", name: "sugerencias", detail: "sin modelo: el registro de bond no tiene nada para pi", fix: "bond models init" };

	const list = Array.isArray(s.enabledModels) ? s.enabledModels : undefined;
	const parts = [model, s.installed ? "paquete instalado" : "paquete no instalado"];
	let warn = !s.installed;

	if (!list || list.length === 0) {
		parts.push("enabledModels: sin poner, la extensión no ve modelos");
		warn = true;
	} else {
		parts.push(`enabledModels: ${list.length === 1 && list[0] === "*" ? "todos" : list.join(", ")}`);
		if (!enabledModelsCover(model, list)) {
			parts.push("el elegido queda fuera de enabledModels");
			warn = true;
		}
	}

	if (s.supiModel !== model) {
		parts.push(`la extensión tiene: ${s.supiModel ?? "nada"}`);
		warn = true;
	}

	if (s.otherEditors?.length) {
		parts.push(`otras extensiones de editor: ${s.otherEditors.join(", ")} (solo una puede estar activa)`);
		warn = true;
	}

	const detail = parts.join(" · ");
	return { level: warn ? "warn" : "ok", name: "sugerencias", detail, fix: warn ? "bond setup" : undefined };
}

async function checkSuggestions(): Promise<void> {
	if (chosen.length && !chosen.includes("pi")) return; // las sugerencias son de pi
	if (!which("pi")) return;
	const { isPackageDeclared, otherEditorExtensions, pickSuggestionModel, readJsonFile, readSupiModel, suggestionPaths } = await import("./suggestions.mts");
	let enabled = true;
	let configuredModel: string | undefined;
	let resolvedModel: string | undefined;
	try {
		const { configExists, loadConfig } = await import("./config.mts");
		if (configExists()) {
			const cfg = loadConfig();
			enabled = cfg.suggestions?.enabled !== false;
			configuredModel = cfg.suggestions?.model;
			resolvedModel = pickSuggestionModel(cfg);
		}
		// Sin config.toml no hay registro que consultar: suggestionsCheck lo dice con su «sin modelo».
	} catch {
		// Sin dependencias o con config.toml roto: se informa con lo que hay.
	}
	const paths = suggestionPaths();
	const piSettings = readJsonFile(paths.piSettings);
	const r = suggestionsCheck({
		enabled,
		configuredModel,
		resolvedModel,
		supiModel: readSupiModel(paths),
		installed: isPackageDeclared(piSettings),
		enabledModels: piSettings?.enabledModels,
		otherEditors: otherEditorExtensions(),
	});
	add(r.level, r.name, r.detail, r.fix);
}

async function checkUpdate(): Promise<void> {
	let state: UpdateState | undefined;
	let auto = true;
	try {
		const { loadState, updateAuto } = await import("./config.mts");
		state = loadState().update;
		auto = updateAuto();
	} catch {
		// Sin dependencias (repo sin npm ci): se informa con lo que hay.
	}
	const r = updateCheck({ method: installMethod(), state, auto, disabled: process.env.BOND_NO_UPDATE === "1" });
	add(r.level, r.name, r.detail, r.fix);
}

export async function doctor(args: string[]): Promise<void> {
	const quick = args.includes("--quick");
	for (const a of args) if (a !== "--quick") die(`opción desconocida: ${a} (bond doctor --help)`);

	// Agentes elegidos en bond setup: las comprobaciones de cada agente solo si es uno de ellos.
	try {
		const { configExists, loadConfig } = await import("./config.mts");
		if (configExists()) chosen = loadConfig().agents;
	} catch {
		// Sin dependencias (repo sin npm ci): se comprueba todo lo instalado.
	}
	checkNode();
	checkConfig();
	checkHerdr();
	checkPi();
	await checkAgy();
	checkHerdrSkill();
	checkGlobalSkills();
	await checkAgyPlugin();
	checkTools();
	if (!quick) checkMcp();
	await checkModels();
	await checkRepo();
	await checkHubRow();
	await checkDecisionsRow();
	await checkCatalogs(quick);
	checkBond();
	await checkUpdate();
	await checkSuggestions();

	const mark = { ok: ok("✓"), warn: caution("!"), fail: bad("✗") };
	const width = Math.max(...results.map((r) => r.name.length));
	for (const r of results) {
		console.log(`${mark[r.level]} ${r.name.padEnd(width)}  ${r.detail}${r.fix ? dim(`  → ${r.fix}`) : ""}`);
	}
	const fails = results.filter((r) => r.level === "fail").length;
	const warns = results.filter((r) => r.level === "warn").length;
	console.log(`\n${fails ? bad(`${fails} fallo(s)`) : ok("sin fallos")}${warns ? `, ${caution(`${warns} aviso(s)`)}` : ""}${quick ? dim(" (sin MCP: --quick)") : ""}`);
	if (fails) process.exitCode = 1;
}
