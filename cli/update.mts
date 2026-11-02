// `bond update`: pone bond al día. Con el binario de los instaladores (install.sh, install.ps1)
// descarga el de la release, comprueba su SHA-256, prueba que arranca y sustituye el actual;
// con Homebrew, npm o desde el código, dice el comando de cada uno.
//
// offerUpdate(): al abrir el puesto de trabajo (bond, bond dev, bond team), mira una vez al día
// si hay release nueva y pregunta: actualizar ahora, omitir esa versión o no volver a preguntar.
// Con «1» instala el binario o corre brew; sin respuesta no toca nada; sin terminal solo avisa.
//
// refreshRuntime(): en cada arranque desde el binario, reenlaza lo que apunta a los ficheros de
// otra versión (~/.bond/pi, skills globales) y borra los de las versiones viejas en
// ~/.bond/runtime. Así sirve venga la versión de bond update, de brew o de npm.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, chmodSync, constants, existsSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { t } from "./messages.mts";
import { BOND_HOME, ensureBondLink, FROM_SOURCE, VERSION } from "./runtime.mts";
import { caution, COPY_MARK, copyPath, die, dim, isCopyOf, isDryRun, linkTarget, log, ok, REPO_DIR, run, samePath, warn } from "./util.mts";

export const updateHelp = (): string => t("update.help");
export const UPDATE_HELP = updateHelp();

/** Releases de bond; BOND_RELEASES_URL las cambia (pruebas, espejos). */
const releases = () => (process.env.BOND_RELEASES_URL || "https://github.com/jmanuelcorral/bond/releases").replace(/\/+$/, "");

/** Compara dos versiones X.Y.Z (con o sin "v"): <0, 0 o >0. */
export function compareVersions(a: string, b: string): number {
	const parts = (v: string) => v.replace(/^v/, "").split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
	return 0;
}

/** Tag de la última release, por la redirección de /releases/latest (sin la API ni su límite). */
export async function latestTag(base = releases(), signal?: AbortSignal): Promise<string> {
	const r = await fetch(`${base}/latest`, { redirect: "manual", signal });
	const tag = /\/tag\/(v[^/?#]+)/.exec(r.headers.get("location") ?? "")?.[1];
	if (!tag) throw new Error(t("update.err_not_found", { base, status: r.status }));
	return tag;
}

/** Nombre del binario de la release para esta plataforma. */
export function assetName(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
	// Windows en ARM ejecuta el de x64 emulado: es el único que se publica.
	if (platform === "win32" && (arch === "x64" || arch === "arm64")) return "bond-windows-x64.exe";
	const os = ({ linux: "linux", darwin: "darwin" } as Record<string, string>)[platform];
	if (!os || !["x64", "arm64"].includes(arch)) throw new Error(t("update.err_no_binary", { platform, arch }));
	return `bond-${os}-${arch}`;
}

async function download(url: string): Promise<Buffer> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(t("update.err_download_failed", { url, status: r.status }));
	return Buffer.from(await r.arrayBuffer());
}

/** Binario de una release, comprobado contra su SHA256SUMS. */
export async function downloadVerified(tag: string, asset: string, base = releases()): Promise<Buffer> {
	const sums = (await download(`${base}/download/${tag}/SHA256SUMS`)).toString("utf8");
	const expected = sums
		.split("\n")
		.map((l) => l.trim().split(/\s+/))
		.find(([, name]) => name?.replace(/^\*/, "") === asset)?.[0];
	if (!expected) throw new Error(t("update.err_missing_sha", { asset, tag }));
	const bin = await download(`${base}/download/${tag}/${asset}`);
	if (createHash("sha256").update(bin).digest("hex") !== expected.toLowerCase()) {
		throw new Error(t("update.err_sha_mismatch"));
	}
	return bin;
}

export type Method = "binary" | "brew" | "npm" | "source";

/** Cómo se instaló este bond. */
export function installMethod(execPath = process.execPath, fromSource = FROM_SOURCE): Method {
	if (fromSource) return "source";
	// El paquete de npm es JavaScript: lo ejecuta node (o bun), no un binario propio.
	if (/^(node|bun)(\.exe)?$/i.test(basename(execPath))) return "npm";
	let real = execPath;
	try {
		real = realpathSync(execPath);
	} catch {
		// Se queda la ruta tal cual.
	}
	return /[\\/]Cellar[\\/]/.test(real) ? "brew" : "binary";
}

/** Sustituye el ejecutable `exe` por `fresh` (en la misma carpeta, para que el cambio sea atómico). */
export function replaceBinary(fresh: string, exe: string, platform: NodeJS.Platform = process.platform): void {
	if (platform !== "win32") {
		chmodSync(fresh, 0o755);
		renameSync(fresh, exe);
		return;
	}
	// Windows no deja sobrescribir un ejecutable en marcha, pero sí renombrarlo: el .old lo
	// borra el siguiente bond (cleanupOld).
	const old = `${exe}.old`;
	try {
		rmSync(old, { force: true });
	} catch {
		// Otro bond antiguo sigue en marcha: se queda para la próxima vez.
	}
	renameSync(exe, existsSync(old) ? `${old}-${process.pid}` : old);
	renameSync(fresh, exe);
}

/** Borra el bond.exe.old que deja una actualización en Windows. */
export function cleanupOld(): void {
	if (process.platform !== "win32" || FROM_SOURCE) return;
	const dir = dirname(process.execPath);
	const name = `${basename(process.execPath)}.old`;
	try {
		for (const f of readdirSync(dir)) if (f.startsWith(name)) rmSync(join(dir, f), { force: true });
	} catch {
		// Sigue en uso: la próxima vez.
	}
}

/**
 * ~/.bond/pi y los skills globales que apuntan a los ficheros de otra
 * versión pasan a los de esta, y se borran las versiones viejas de ~/.bond/runtime.
 */
export async function refreshRuntime(): Promise<void> {
	if (FROM_SOURCE) return;
	const runtimes = join(BOND_HOME, "runtime");
	if (linkTarget(join(BOND_HOME, "pi")) !== undefined) await ensureBondLink();
	const { globalSkillsDir, globalSkillTargets } = await import("./setup.mts");
	for (const name of readdirSync(globalSkillsDir())) {
		const src = join(globalSkillsDir(), name);
		for (const dest of globalSkillTargets(name)) {
			const target = linkTarget(dest);
			if (target !== undefined && target.startsWith(runtimes) && !samePath(dest, src)) {
				rmSync(dest);
				symlinkSync(src, dest);
			} else if (existsSync(join(dest, COPY_MARK)) && !isCopyOf(src, dest)) copyPath(src, dest);
		}
	}
	let versions: string[] = [];
	try {
		versions = readdirSync(runtimes);
	} catch {
		return;
	}
	// Las .tmp-<pid> pueden ser de otro bond extrayendo ahora: solo se borran pasada una hora.
	const stale = (p: string) => Date.now() - statSync(p).mtimeMs > 3_600_000;
	for (const v of versions) {
		if (v === VERSION || !/^\d+\.\d+\.\d+/.test(v)) continue;
		if (v.includes(".tmp-") && !stale(join(runtimes, v))) continue;
		try {
			rmSync(join(runtimes, v), { recursive: true, force: true });
		} catch {
			// En uso (Windows): la próxima vez.
		}
	}
}

const BREW_FORMULA = "jmanuelcorral/tap/bond";

/** Comando para actualizar a mano con un método que bond no aplica solo. */
function manualCommand(method: Exclude<Method, "binary">, version: string, base = releases()): string {
	if (method === "source") return t("update.manual_source", { dir: REPO_DIR });
	if (method === "brew") return t("update.manual_brew", { formula: BREW_FORMULA });
	// @jmanuelcorral/bond aún no está en npm (npm i -g daría 404): el paquete va en la release.
	return t("update.manual_npm", { url: `${base}/download/v${version}/jmanuelcorral-bond-${version}.tgz` });
}

function assertWritable(exe: string): void {
	try {
		accessSync(dirname(exe), constants.W_OK);
	} catch {
		throw new Error(t("update.err_not_writable", { dir: dirname(exe) }));
	}
}

/**
 * Instala la release `want` en `exe`: descarga, SHA-256, prueba de arranque y sustitución atómica.
 * Si algo falla lanza el error y `exe` se queda como estaba.
 */
export async function installBinary(want: string, exe = process.execPath, base = releases()): Promise<void> {
	const version = want.slice(1);
	assertWritable(exe);
	const asset = assetName();
	log(t("update.downloading", { asset, tag: want }));
	const bin = await downloadVerified(want, asset, base);
	const fresh = join(dirname(exe), `.bond-${version}-${process.pid}${process.platform === "win32" ? ".exe" : ""}`);
	writeFileSync(fresh, bin, { mode: 0o755 });
	// La versión nueva tiene que arrancar antes de sustituir la actual.
	const v = run(fresh, ["--version"]);
	if (v.status !== 0 || v.stdout.trim() !== version) {
		rmSync(fresh, { force: true });
		throw new Error(t("update.err_binary_start", { detail: (v.stderr || v.stdout).trim() || `status ${v.status}` }));
	}
	try {
		replaceBinary(fresh, exe);
	} catch (e) {
		rmSync(fresh, { force: true });
		throw new Error(t("update.err_replace", { exe, error: (e as Error).message }));
	}
	log(t("update.installed_binary", { version, exe }));
	// La versión nueva extrae sus ficheros y limpia los de las anteriores (bond < 1.1 no sabe:
	// lo hará la siguiente que sí).
	if (run(exe, ["_runtime"]).status !== 0) warn(t("update.warn_no_cleanup", { version }));
}

/**
 * Actualiza con Homebrew a `version`, con la salida de brew a la vista. Si brew falla (lock, sin
 * red, tap caído) o no trae esa versión, lanza el error y bond sigue como estaba.
 */
export function installBrew(version: string): void {
	log(t("update.brew_note"));
	for (const args of [["update"], ["upgrade", BREW_FORMULA]]) {
		console.log(dim(`  $ brew ${args.join(" ")}`));
		const r = spawnSync("brew", args, { stdio: "inherit" });
		if (r.status !== 0) throw new Error(t("update.err_brew_failed", { cmd: `brew ${args.join(" ")}`, detail: r.error ? `: ${r.error.message}` : ` (status ${r.status ?? r.signal})` }));
	}
	const exe = join(run("brew", ["--prefix", "bond"]).stdout.trim(), "bin", "bond");
	const v = run(exe, ["--version"]).stdout.trim();
	if (v !== version) throw new Error(t("update.err_brew_stale", { version, exe, got: v || t("update.nothing") }));
	log(t("update.installed_brew", { version, exe }));
	if (run(exe, ["_runtime"]).status !== 0) warn(t("update.warn_no_cleanup", { version }));
}

export async function update(args: string[]): Promise<void> {
	let check = false;
	let force = false;
	let asked: string | undefined;
	let skip: string | undefined;
	let skipReset = false;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--check") check = true;
		else if (a === "--force") force = true;
		else if (a === "--version") asked = args[++i] ?? die(t("update.opt_version_val"));
		else if (a === "--skip") skip = args[++i] ?? die(t("update.opt_skip_val"));
		else if (a === "--skip-reset") skipReset = true;
		else if (a !== "--dry-run") die(t("update.unknown_opt", { opt: a }));
	}
	if (skip !== undefined || skipReset) {
		if (skip !== undefined && skipReset) die(t("update.err_skip_conflict"));
		if (check || force || asked) die(t("update.err_skip_with_other", { flag: skipReset ? "--skip-reset" : "--skip" }));
		return skipVersion(skip);
	}

	let want: string;
	try {
		want = asked ? `v${asked.replace(/^v/, "")}` : await latestTag();
	} catch (e) {
		die((e as Error).message);
	}
	const diff = compareVersions(want, VERSION);
	if (diff === 0 && !force) return console.log(ok(t(asked ? "update.already_that" : "update.already_latest", { version: VERSION })));
	if (diff < 0 && !asked) return console.log(ok(t("update.newer_than_latest", { version: VERSION, tag: want })));
	console.log(`bond ${VERSION} → ${want.slice(1)}`);
	if (check) return;

	const method = installMethod();
	if (method !== "binary") return console.log(manualCommand(method, want.slice(1)));

	const exe = process.execPath;
	try {
		assertWritable(exe);
		if (isDryRun()) return console.log(dim(t("update.dry_run_binary", { asset: assetName(), tag: want, exe })));
		await installBinary(want, exe);
	} catch (e) {
		die((e as Error).message);
	}
	console.log(ok(t("update.ready")));
}

/**
 * Guarda en state.json la versión que el aviso de arranque no debe nombrar (la misma que su
 * opción 2), o la quita sin versión. No toca la red.
 */
async function skipVersion(version?: string): Promise<void> {
	const { loadState, saveState } = await import("./config.mts");
	const state = loadState();
	const previous = state.update?.skipped;
	if (version === undefined) {
		if (!previous) return console.log(ok(t("update.no_skipped")));
		const { skipped: _, ...rest } = state.update ?? {};
		state.update = rest;
		if (isDryRun()) return console.log(dim(t("update.dry_run_skip_reset", { version: previous.slice(1) })));
		saveState(state);
		return console.log(ok(t("update.skip_reset_done", { version: previous.slice(1) })));
	}
	if (!/^v?\d+\.\d+\.\d+$/.test(version)) die(t("update.err_skip_format", { version }));
	const tag = `v${version.replace(/^v/, "")}`;
	state.update = { ...state.update, skipped: tag };
	if (isDryRun()) return console.log(dim(t("update.dry_run_skip", { version: tag.slice(1), file: join(BOND_HOME, "state.json") })));
	saveState(state);
	console.log(ok(t("update.skip_set", { version: tag.slice(1) })));
	if (compareVersions(tag, VERSION) <= 0) console.log(dim(t("update.already_have", { version: VERSION })));
}

const DAY_MS = 24 * 3_600_000;

export interface OfferOptions {
	base?: string;
	now?: number;
	/** Tope de la consulta a las releases (ms). */
	timeoutMs?: number;
	/** ¿Se puede preguntar? Por defecto, si la entrada y la salida son una terminal. */
	interactive?: boolean;
	/** Lee la respuesta (por defecto, una línea de la terminal). */
	ask?: (question: string) => Promise<string>;
	method?: Method;
	exe?: string;
}

/**
 * Qué pasó: off (desactivado), throttled (ya se miró hace menos de 24 h), offline, current,
 * skipped (versión omitida), informed (sin terminal), later (ni 1 ni 2 ni 3), skip, never,
 * manual (se dijo el comando), updated o failed.
 */
export type Offer = "off" | "throttled" | "offline" | "current" | "skipped" | "informed" | "later" | "skip" | "never" | "manual" | "updated" | "failed";

async function askLine(question: string): Promise<string> {
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	rl.on("SIGINT", () => process.exit(130));
	try {
		return await rl.question(question);
	} finally {
		rl.close();
	}
}

/**
 * Si hay release nueva, la ofrece. Como mucho una consulta cada 24 h (state.json) y de ~2 s: sin
 * red o sin respuesta a tiempo, el arranque sigue igual. Nunca actualiza sin que se diga «1».
 */
export async function offerUpdate(o: OfferOptions = {}): Promise<Offer> {
	if (process.env.BOND_NO_UPDATE === "1" || isDryRun()) return "off";
	const { loadState, saveState, setUpdateAuto, updateAuto } = await import("./config.mts");
	if (!updateAuto()) return "off";
	const state = loadState();
	const now = o.now ?? Date.now();
	const last = Date.parse(state.update?.checkedAt ?? "");
	if (now >= last && now - last < DAY_MS) return "throttled";

	let latest: string | undefined;
	try {
		latest = await latestTag(o.base ?? releases(), AbortSignal.timeout(o.timeoutMs ?? 2000));
	} catch {
		// Sin red, sin respuesta a tiempo o sin release: se vuelve a mirar mañana.
	}
	const record = { ...state.update, checkedAt: new Date(now).toISOString(), ...(latest && { latest }) };
	state.update = record;
	try {
		saveState(state);
	} catch {
		// Sin poder guardar, se mirará en el próximo arranque: no es motivo para no arrancar.
	}
	if (!latest) return "offline";
	if (compareVersions(latest, VERSION) <= 0) return "current";
	if (record.skipped === latest) return "skipped";

	const version = latest.slice(1);
	const interactive = o.interactive ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
	if (!interactive) {
		console.error(`${caution("bond")} ${t("update.offer_available", { latest: version, current: VERSION })}`);
		return "informed";
	}
	console.log(`\n${t("update.offer_prompt_header", { current: VERSION, latest: version })}`);
	console.log(t("update.offer_opt_1"));
	console.log(t("update.offer_opt_2", { version }));
	console.log(t("update.offer_opt_3"));
	const answer = (await (o.ask ?? askLine)(t("update.offer_ask"))).trim();
	if (answer === "2") {
		record.skipped = latest;
		saveState(state);
		console.log(dim(t("update.offer_skip_ack", { version })));
		return "skip";
	}
	if (answer === "3") {
		setUpdateAuto(false);
		console.log(dim(t("update.offer_never_ack")));
		return "never";
	}
	if (answer !== "1") return "later";

	const method = o.method ?? installMethod();
	if (method !== "binary" && method !== "brew") {
		console.log(manualCommand(method, version, o.base ?? releases()));
		return "manual";
	}
	try {
		if (method === "brew") installBrew(version);
		else await installBinary(latest, o.exe ?? process.execPath, o.base ?? releases());
		return "updated";
	} catch (e) {
		warn(t("update.warn_not_updated", { error: (e as Error).message, version: VERSION }));
		return "failed";
	}
}
