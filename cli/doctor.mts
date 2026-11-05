// `bond doctor`: comprueba que la máquina está como la deja `bond setup` y que lo que depende
// de fuera (Herdr, MCP, la pasarela de modelos) responde. Sale con 1 si algo falla.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";
import type { UpdateState } from "./config.mts";
import { enabledModelsCover } from "./suggestions.mts";
import { assetsPath, BOND_HOME, FROM_SOURCE, installedRuntime, VERSION } from "./runtime.mts";
import { compareVersions, installMethod, type Method } from "./update.mts";
import { AGY_PLUGIN_JSON, CONTEXT_TOOLS, globalSkillsDir, globalSkillTargets, herdrIntegrationStatus, herdrSkillDir, integrationsFor, PI_HERDR_SKILL, SHARED_HERDR_SKILL } from "./setup.mts";
import { agentInfo, agyLocalBin, agyPluginDir } from "./catalog-agents.mts";
import { t } from "./messages.mts";
import { AGENT_DIR, bad, catchDie, caution, die, dim, HOME, isCopyOf, linkTarget, ok, REPO_DIR, run, samePath, which } from "./util.mts";

/** Skill global en su sitio: enlazado (o, en Windows, copiado) desde bond. */
const installedSkill = (src: string, dest: string) => (process.platform === "win32" ? isCopyOf(src, dest) : !!linkTarget(dest) && samePath(dest, src));

export const doctorHelp = (): string => t("doctor.help");
export const DOCTOR_HELP = doctorHelp();

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
	if (!chosen.length) return add("warn", t("doctor.row_agents"), t("doctor.agents_not_chosen"), "bond setup");
	add("ok", t("doctor.row_agents"), chosen.join(", "));
	// Claves: carpeta 700 y ficheros 600 (en Windows no aplica).
	const keys = join(BOND_HOME, "keys");
	if (process.platform === "win32" || !existsSync(keys)) return;
	const loose = [keys, ...readdirSync(keys).map((f) => join(keys, f))].filter((f) => (statSync(f).mode & 0o077) !== 0);
	if (loose.length) add("fail", t("doctor.row_keys"), t("doctor.keys_too_open", { files: loose.join(", ") }), "chmod 700 ~/.bond/keys && chmod 600 ~/.bond/keys/*");
	else add("ok", t("doctor.row_keys"), t("doctor.keys_ok"));
}

function checkNode(): void {
	const [major, minor] = process.versions.node.split(".").map(Number);
	if (major > 22 || (major === 22 && minor >= 18)) add("ok", "node", process.versions.node);
	else add("fail", "node", t("doctor.node_outdated", { version: process.versions.node }));
}

function checkHerdr(): void {
	if (!which("herdr")) return add("fail", "herdr", t("doctor.herdr_not_in_path"), "https://herdr.dev/docs/install/");
	const status = run("herdr", ["status"]).stdout;
	const client = /client:[\s\S]*?version: (\S+)/.exec(status)?.[1] ?? "?";
	const running = /server:[\s\S]*?status: running/.test(status);
	add(running ? "ok" : "warn", "herdr", running ? t("doctor.herdr_running", { client }) : t("doctor.herdr_stopped", { client }), running ? undefined : t("doctor.herdr_fix_start"));
	// Integración de Herdr de cada agente instalado: pi es obligatoria; las demás, aviso.
	const states = integrationsFor(herdrIntegrationStatus(), chosen);
	const current = states.filter((s) => s.state.startsWith("current")).map((s) => s.integration);
	if (current.length) add("ok", t("doctor.row_herdr_integrations"), current.join(", "));
	for (const s of states.filter((x) => !x.state.startsWith("current"))) {
		add(s.agent === "pi" ? "fail" : "warn", t("doctor.row_herdr_integration", { name: s.integration }), s.state, "bond setup");
	}
}

function checkPi(): void {
	if (chosen.length && !chosen.includes("pi")) return; // pi no es uno de tus agentes
	if (!which("pi")) return add("fail", "pi", t("doctor.pi_not_in_path"), "bond setup");
	add("ok", "pi", run("pi", ["--version"]).stdout.trim());
	// Restos de bond 0.7: config de pi enlazada al repo o el repo como paquete global.
	const legacy = ["settings.json", "AGENTS.md", "mcp.json", "bond", "pisetup", "prompts"].filter((f) => linkTarget(join(AGENT_DIR, f)) !== undefined);
	if (legacy.length) add("warn", t("doctor.row_legacy_install"), t("doctor.legacy_links", { links: legacy.join(", ") }), "bond migrate");
	// Bond Extensions: ~/.bond/pi tiene que apuntar a la versión instalada. Desde el repo
	// (desarrollo), un enlace a un runtime instalado válido es aviso: pi usa las extensiones
	// de esa versión, no las del repo.
	const link = join(BOND_HOME, "pi");
	const target = linkTarget(link);
	if (!target) add("warn", "Bond Extensions", t("doctor.ext_missing"), "bond setup");
	else if (samePath(link, assetsPath())) add("ok", "Bond Extensions", t("doctor.ext_link", { target: FROM_SOURCE ? t("doctor.target_repo") : t("doctor.target_runtime") }));
	else {
		const runtime = FROM_SOURCE ? installedRuntime(target) : undefined;
		if (runtime) add("warn", "Bond Extensions", t("doctor.ext_runtime_warn", { runtime }), "bond setup");
		else add("fail", "Bond Extensions", t("doctor.ext_wrong_version"), "bond setup");
	}
}

/**
 * Fila de Antigravity: su versión si `agy` está en el PATH. Su instalador lo deja en
 * ~/.local/bin, que no siempre está en el PATH de las shells no interactivas (Herdr, bond
 * team): si está ahí pero no en el PATH, avisa de eso y no de que falte.
 */
export function agyCheck(o: { path?: string; version?: string; local?: string }): Check {
	if (o.path) return { level: "ok", name: "agy", detail: o.version ?? "?" };
	if (o.local) return { level: "warn", name: "agy", detail: t("doctor.agy_in_local", { path: o.local }), fix: t("doctor.agy_in_local_fix", { dir: dirname(o.local) }) };
	return { level: "warn", name: "agy", detail: t("doctor.agy_not_installed"), fix: agentInfo("agy")?.install };
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
	if (shared && mine) return add("fail", t("doctor.row_herdr_skill"), t("doctor.herdr_skill_dup"), "bond setup");
	if (!shared && !mine) return add("fail", t("doctor.row_herdr_skill"), t("doctor.herdr_skill_not_installed"), "bond setup");
	const file = shared ? SHARED_HERDR_SKILL : PI_HERDR_SKILL;
	const fresh = which("herdr") ? run("herdr", ["--skill"]).stdout.trimEnd() : "";
	if (fresh && readFileSync(file, "utf8").trimEnd() !== fresh) {
		add("warn", t("doctor.row_herdr_skill"), t("doctor.herdr_skill_outdated", { which: shared ? t("doctor.skill_shared") : t("doctor.skill_pi") }), shared ? "npx skills update herdr" : "bond setup");
	} else add("ok", t("doctor.row_herdr_skill"), shared ? t("doctor.skill_shared_loc") : t("doctor.skill_pi"));
}

function checkGlobalSkills(): void {
	const missing: string[] = [];
	for (const name of readdirSync(globalSkillsDir())) {
		for (const dest of globalSkillTargets(name, false)) if (!installedSkill(join(globalSkillsDir(), name), dest)) missing.push(dest.replace(process.env.HOME ?? "", "~"));
	}
	if (missing.length) add("fail", t("doctor.row_global_skills"), t("doctor.global_skills_missing", { list: missing.join(", ") }), "bond setup");
	else add("ok", t("doctor.row_global_skills"), t("doctor.global_skills_ok", { list: readdirSync(globalSkillsDir()).join(", ") }));
}

/** Fila del plugin global de bond para agy: manifiesto, reglas al día y skills enlazadas. */
export function agyPluginCheck(o: { manifest: boolean; rules: boolean; skills: string[]; missing: string[] }): Check {
	const problems = [...(o.manifest ? [] : [t("doctor.agy_no_manifest")]), ...(o.rules ? [] : [t("doctor.agy_rules_stale")]), ...(o.missing.length ? [t("doctor.agy_skills_missing", { list: o.missing.join(", ") })] : [])];
	if (problems.length) return { level: "fail", name: t("doctor.row_agy_plugin"), detail: problems.join("; "), fix: "bond setup" };
	return { level: "ok", name: t("doctor.row_agy_plugin"), detail: t("doctor.agy_plugin_ok", { list: o.skills.join(", ") }) };
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
	if (missing.length === 0) add("ok", t("doctor.row_tools"), CONTEXT_TOOLS.map(([c]) => c).join(" "));
	for (const [c, why] of missing) add("warn", t("doctor.row_tool", { name: c }), t("doctor.tool_missing", { why }));
}

function checkMcp(): void {
	if (!which("pi")) return;
	const r = run("pi", ["mcp", "list"], { timeout: 120_000 });
	for (const m of r.stdout.matchAll(/^(\S+): (connected|[^\n]+)$/gm)) {
		const [, name, state] = m;
		add(state.startsWith("connected") ? "ok" : "fail", `mcp ${name}`, state, state.startsWith("connected") ? undefined : "pi mcp list");
	}
	if (r.status !== 0 && !/connected/.test(r.stdout)) add("fail", "mcp", r.stderr.trim().split("\n")[0] || t("doctor.mcp_failed"));
}

/**
 * Fila de Codex en `bond doctor`: el bloque huérfano que bond dejó en ~/.codex/config.toml al
 * dejar de aprovisionarlo (#80). Sin bloque no hay fila: no se molesta a quien no lo usó.
 */
export function codexOrphanCheck(present: boolean, file: string): Check | undefined {
	if (!present) return undefined;
	return { level: "warn", name: "codex", detail: t("doctor.codex_orphan", { file }), fix: t("doctor.codex_orphan_fix") };
}

/** Registro global de modelos: config, sincronía con cada agente y que las pasarelas respondan. */
async function checkModels(): Promise<void> {
	if (FROM_SOURCE && !existsSync(join(REPO_DIR, "node_modules", "smol-toml"))) {
		return add("fail", t("doctor.row_deps"), t("doctor.deps_missing"), "bond setup");
	}
	const { CONFIG_FILE, activeProviders, loadConfig } = await import("./config.mts");
	if (!existsSync(CONFIG_FILE)) return add("fail", t("doctor.row_config"), t("doctor.config_missing", { file: CONFIG_FILE }), "bond setup");
	const { syncAgents, codexOrphan } = await import("./models.mts");
	const { codexConfigFile } = await import("./agents.mts");
	const withModels = ["pi", "opencode", "crush"].filter((a) => !chosen.length || chosen.includes(a));
	const stale = withModels.length && activeProviders(loadConfig()).length ? syncAgents({ check: true, quiet: true, agents: withModels.filter((a) => which(a)) }) : [];
	// El huérfano de Codex se comprueba aparte: `syncAgents` lo barre y lo mete en `stale`, pero
	// aquí interesa su fila propia, no que salga mezclado con los agentes desfasados.
	const orphan = codexOrphanCheck(codexOrphan(), codexConfigFile());
	if (orphan) add(orphan);
	if (withModels.includes("pi") && which("pi")) {
		if (stale.includes("pi")) add("fail", t("doctor.row_pi_models"), t("doctor.pi_models_stale"), "bond models sync --agent pi");
		else add("ok", t("doctor.row_pi_models"), t("doctor.pi_models_ok"));
	}
	const others = stale.filter((a) => a !== "pi" && a !== "codex");
	if (others.length) add("warn", t("doctor.row_other_models"), t("doctor.other_models_stale", { list: others.join(", ") }), "bond models sync");

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
			if (missing.length) add("warn", t("doctor.row_gateway", { id: p.id }), t("doctor.gateway_missing_models", { list: missing.join(", ") }));
			else add("ok", t("doctor.row_gateway", { id: p.id }), t("doctor.gateway_serves", { url: p.base_url, list: declared.join(", ") }));
		} catch (e) {
			add("fail", t("doctor.row_gateway", { id: p.id }), t("doctor.gateway_unresponsive", { url: p.base_url, error: (e as Error).message }));
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
	if (!actions.length) add("ok", "repo", t("doctor.repo_config_ok", { root }));
	else add(conflicts ? "fail" : "warn", "repo", t("doctor.repo_changes", { root, count: actions.length, conflicts: conflicts ? t("doctor.repo_conflicts", { count: conflicts }) : "" }), "bond sync");
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
		if (b.error !== undefined) add("fail", "hub", t("doctor.hub_invalid", { error: b.error }), t("doctor.hub_fix_help"));
		return;
	}
	const s = catchDie(() => hubSession(root));
	if (s.error !== undefined) return add("fail", "hub", t("doctor.hub_invalid", { error: s.error }), t("doctor.hub_fix_help"));
	if (!s.value) return;
	const { checkHubSession } = await import("./hub-check.mts");
	const r = catchDie(() => checkHubSession(s.value!));
	if (r.error !== undefined) return add("fail", `hub ${s.value.name}`, r.error, "bond hub check");
	const named = (level: string) => r.value!.repos.flatMap((rp) => rp.checks.filter((c) => c.level === level).map((c) => `${rp.repo} · ${c.check}`));
	const failed = named("fail");
	const warned = named("warn");
	if (failed.length) add("fail", `hub ${r.value.hub}`, t("doctor.hub_problems", { count: failed.length, list: failed.join("; ") }), "bond hub check");
	// Los avisos del hub se reflejan sin pasar la fila a fallo.
	else if (warned.length) add("warn", `hub ${r.value.hub}`, t("doctor.hub_warnings", { count: warned.length, list: warned.join("; ") }), "bond hub check");
	else add("ok", `hub ${r.value.hub}`, t("doctor.hub_repos_ok", { count: r.value.repos.length - 1 }));
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
	const name = t("doctor.row_catalog", { name: s.name });
	if (s.error) return { level: "fail", name, detail: s.error, fix: s.kind === "git" ? `bond catalog update ${s.name}` : undefined };
	if (s.kind === "local") return { level: "ok", name, detail: t("doctor.catalog_local_dir", { dir: s.where }) };
	const parts = [`${s.sha?.slice(0, 7)}${s.cached ? t("doctor.catalog_cached") : t("doctor.catalog_uncached")}`];
	if (!s.verified) parts.push(t("doctor.catalog_unverified"));
	else if (s.remoteSha === s.sha) parts.push(t("doctor.catalog_up_to_date", { ref: s.ref ?? t("doctor.catalog_default_branch") }));
	else return { level: "warn", name, detail: t("doctor.catalog_newer_commit", { parts: parts.join(" · "), ref: s.ref ?? t("doctor.catalog_the_ref"), sha: s.remoteSha?.slice(0, 7) ?? "" }), fix: `bond catalog update ${s.name}` };
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
				add("fail", t("doctor.row_catalog", { name }), t("doctor.catalog_git_no_name"), "bond catalog update");
				continue;
			}
			if (lockError) {
				add("fail", t("doctor.row_catalog", { name }), t("doctor.catalog_lock_unreadable", { error: lockError }), "bond catalog update");
				continue;
			}
			const ref = text(entry?.ref);
			const locked = lock!.catalogs[name];
			if (!locked) {
				add("fail", t("doctor.row_catalog", { name }), t("doctor.catalog_not_locked", { url }), `bond catalog update ${name}`);
				continue;
			}
			if (gitKey(locked.git) !== gitKey(url) || (locked.ref ?? "") !== (ref ?? "")) {
				add("fail", t("doctor.row_catalog", { name }), t("doctor.catalog_lock_mismatch"), `bond catalog update ${name}`);
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
			if (!existsSync(dir) || !statSync(dir).isDirectory()) add("fail", t("doctor.row_catalog", { name }), t("doctor.catalog_dir_missing", { path }), "bond catalog add <carpeta>");
			else add(catalogCheck({ name, kind: "local", where: path, verified: true }));
		} else add("fail", "catálogo", t("doctor.catalog_missing_path_git"), "bond catalog add <url|carpeta>");
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
	if (!FROM_SOURCE) return add(p ? "ok" : "warn", t("doctor.row_bond_in_path"), p ?? t("doctor.bond_not_in_path"));
	if (p && samePath(p, join(REPO_DIR, "bin", "bond"))) add("ok", t("doctor.row_bond_in_path"), p);
	else if (p) add("warn", t("doctor.row_bond_in_path"), t("doctor.bond_wrong_repo", { path: p }));
	else add("warn", t("doctor.row_bond_in_path"), t("doctor.bond_missing"), "bond setup");
}

const updateMethods = (): Record<Method, string> => ({
	binary: t("doctor.method_binary"),
	brew: "Homebrew",
	npm: "npm",
	source: t("doctor.method_source"),
});

/**
 * Fila de actualizaciones: método de instalación, última consulta, versión pendiente, omitida y
 * si se pregunta al arrancar. Informa sin fallar: no haber mirado nunca no es un error.
 */
export function updateCheck(o: { method: Method; state?: UpdateState; auto: boolean; disabled?: boolean; version?: string }): Check {
	const version = o.version ?? VERSION;
	const { checkedAt, latest, skipped } = o.state ?? {};
	const when = checkedAt && !Number.isNaN(Date.parse(checkedAt)) ? `${checkedAt.slice(0, 16).replace("T", " ")} UTC` : undefined;
	const pending = latest && compareVersions(latest, version) > 0 ? latest.slice(1) : undefined;
	const ask = o.disabled ? t("doctor.ask_disabled") : o.auto ? t("doctor.ask_yes") : t("doctor.ask_no");
	const detail = [
		updateMethods()[o.method],
		t("doctor.update_last_check", { when: when ?? t("doctor.when_never") }),
		t("doctor.update_pending", { pending: pending ?? t("doctor.pending_none") }),
		t("doctor.update_skipped", { skipped: skipped?.slice(1) ?? t("doctor.skipped_none") }),
		t("doctor.update_ask", { ask }),
	].join(" · ");
	// Pendiente y no omitida: aviso, con el comando. Lo demás es informativo.
	if (pending && skipped !== latest) return { level: "warn", name: t("doctor.row_updates"), detail, fix: "bond update" };
	return { level: "ok", name: t("doctor.row_updates"), detail };
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
	const name = t("doctor.row_suggestions");
	if (!s.enabled) return { level: "ok", name, detail: t("doctor.sugg_disabled"), fix: "bond setup" };
	if (!model) return { level: "warn", name, detail: t("doctor.sugg_no_model"), fix: "bond models init" };

	const list = Array.isArray(s.enabledModels) ? s.enabledModels : undefined;
	const parts = [model, s.installed ? t("doctor.pkg_installed") : t("doctor.pkg_not_installed")];
	let warn = !s.installed;

	if (!list || list.length === 0) {
		parts.push(t("doctor.sugg_no_enabled_models"));
		warn = true;
	} else {
		parts.push(t("doctor.sugg_enabled_models", { list: list.length === 1 && list[0] === "*" ? t("doctor.models_all") : list.join(", ") }));
		if (!enabledModelsCover(model, list)) {
			parts.push(t("doctor.sugg_outside_models"));
			warn = true;
		}
	}

	if (s.supiModel !== model) {
		parts.push(t("doctor.sugg_extension_has", { model: s.supiModel ?? t("doctor.sugg_nothing") }));
		warn = true;
	}

	if (s.otherEditors?.length) {
		parts.push(t("doctor.sugg_other_editors", { list: s.otherEditors.join(", ") }));
		warn = true;
	}

	const detail = parts.join(" · ");
	return { level: warn ? "warn" : "ok", name, detail, fix: warn ? "bond setup" : undefined };
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
	for (const a of args) if (a !== "--quick") die(t("doctor.unknown_opt", { opt: a }));

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
	console.log(`\n${fails ? bad(t("doctor.fails_count", { count: fails })) : ok(t("doctor.no_fails"))}${warns ? `, ${caution(t("doctor.warns_count", { count: warns }))}` : ""}${quick ? dim(t("doctor.quick_note")) : ""}`);
	if (fails) process.exitCode = 1;
}
