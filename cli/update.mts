// `bond update`: pone bond al día. Con el binario de los instaladores (install.sh, install.ps1)
// descarga el de la release, comprueba su SHA-256, prueba que arranca y sustituye el actual;
// con Homebrew, npm o desde el código, dice el comando de cada uno.
//
// offerUpdate(): al abrir el puesto de trabajo (bond, bond dev, bond team), mira una vez al día
// si hay release nueva y pregunta: actualizar ahora, omitir esa versión o no volver a preguntar.
// Sin respuesta no toca nada; sin terminal solo avisa.
//
// refreshRuntime(): en cada arranque desde el binario, reenlaza lo que apunta a los ficheros de
// otra versión (~/.bond/pi, skills globales) y borra los de las versiones viejas en
// ~/.bond/runtime. Así sirve venga la versión de bond update, de brew o de npm.

import { createHash } from "node:crypto";
import { accessSync, chmodSync, constants, existsSync, readdirSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BOND_HOME, ensureBondLink, FROM_SOURCE, VERSION } from "./runtime.mts";
import { caution, COPY_MARK, copyPath, die, dim, isCopyOf, isDryRun, linkTarget, log, ok, REPO_DIR, run, samePath, warn } from "./util.mts";

export const UPDATE_HELP = `Uso: bond update [opciones]

Pone bond al día con la última release de GitHub. Si lo instalaste con install.sh o
install.ps1, descarga el binario, comprueba su SHA-256 y sustituye el actual; con Homebrew o
npm, te dice el comando. La versión nueva quita los ficheros de las anteriores
(~/.bond/runtime) tras reenlazar lo que los usaba.

  --check              Solo dice si hay una versión nueva
  --version <vX.Y.Z>   Instala esa versión (también para volver a una anterior)
  --force              Reinstala aunque ya tengas esa versión
  --dry-run            Dice qué haría sin descargar nada

Al abrir el puesto de trabajo (bond, bond dev, bond team), bond mira una vez al día si hay
release nueva (como mucho ~2 s; sin red, sigue sin más) y pregunta: 1) actualizar ahora,
2) omitir esa versión hasta que salga otra, 3) no volver a preguntar ([update] auto = false
en ~/.bond/config.toml). Sin terminal solo avisa. BOND_NO_UPDATE=1 lo desactiva.`;

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
	if (!tag) throw new Error(`no encuentro la última release en ${base} (HTTP ${r.status})`);
	return tag;
}

/** Nombre del binario de la release para esta plataforma. */
export function assetName(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
	// Windows en ARM ejecuta el de x64 emulado: es el único que se publica.
	if (platform === "win32" && (arch === "x64" || arch === "arm64")) return "bond-windows-x64.exe";
	const os = ({ linux: "linux", darwin: "darwin" } as Record<string, string>)[platform];
	if (!os || !["x64", "arm64"].includes(arch)) throw new Error(`no hay binario de bond para ${platform}-${arch}`);
	return `bond-${os}-${arch}`;
}

async function download(url: string): Promise<Buffer> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`no pude descargar ${url} (HTTP ${r.status})`);
	return Buffer.from(await r.arrayBuffer());
}

/** Binario de una release, comprobado contra su SHA256SUMS. */
export async function downloadVerified(tag: string, asset: string, base = releases()): Promise<Buffer> {
	const sums = (await download(`${base}/download/${tag}/SHA256SUMS`)).toString("utf8");
	const expected = sums
		.split("\n")
		.map((l) => l.trim().split(/\s+/))
		.find(([, name]) => name?.replace(/^\*/, "") === asset)?.[0];
	if (!expected) throw new Error(`${asset} no aparece en SHA256SUMS de ${tag}`);
	const bin = await download(`${base}/download/${tag}/${asset}`);
	if (createHash("sha256").update(bin).digest("hex") !== expected.toLowerCase()) {
		throw new Error("la suma SHA-256 no coincide: descarga corrupta o alterada");
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

/** Comando para actualizar a mano con un método que bond no aplica solo. */
function manualCommand(method: Exclude<Method, "binary">, version: string): string {
	if (method === "source") return `Desde el código: git -C ${REPO_DIR} pull && npm ci --ignore-scripts`;
	if (method === "brew") return "Con Homebrew: brew update && brew upgrade jmanuelcorral/tap/bond";
	return `Con npm: npm i -g @jmanuelcorral/bond@${version}`;
}

function assertWritable(exe: string): void {
	try {
		accessSync(dirname(exe), constants.W_OK);
	} catch {
		throw new Error(`no puedo escribir en ${dirname(exe)}: actualiza con el mismo método con el que instalaste bond`);
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
	log(`Descargando ${asset} (${want})`);
	const bin = await downloadVerified(want, asset, base);
	const fresh = join(dirname(exe), `.bond-${version}-${process.pid}${process.platform === "win32" ? ".exe" : ""}`);
	writeFileSync(fresh, bin, { mode: 0o755 });
	// La versión nueva tiene que arrancar antes de sustituir la actual.
	const v = run(fresh, ["--version"]);
	if (v.status !== 0 || v.stdout.trim() !== version) {
		rmSync(fresh, { force: true });
		throw new Error(`el binario descargado no arranca bien: ${(v.stderr || v.stdout).trim() || `status ${v.status}`}`);
	}
	try {
		replaceBinary(fresh, exe);
	} catch (e) {
		rmSync(fresh, { force: true });
		throw new Error(`no pude sustituir ${exe}: ${(e as Error).message}`);
	}
	log(`bond ${version} instalado en ${exe}`);
	// La versión nueva extrae sus ficheros y limpia los de las anteriores (bond < 1.1 no sabe:
	// lo hará la siguiente que sí).
	if (run(exe, ["_runtime"]).status !== 0) warn(`bond ${version} no limpia ~/.bond/runtime: no pasa nada, ocupan sitio`);
}

export async function update(args: string[]): Promise<void> {
	let check = false;
	let force = false;
	let asked: string | undefined;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--check") check = true;
		else if (a === "--force") force = true;
		else if (a === "--version") asked = args[++i] ?? die("--version necesita un valor (p. ej. v1.0.2)");
		else if (a !== "--dry-run") die(`opción desconocida: ${a} (bond update --help)`);
	}

	let want: string;
	try {
		want = asked ? `v${asked.replace(/^v/, "")}` : await latestTag();
	} catch (e) {
		die((e as Error).message);
	}
	const diff = compareVersions(want, VERSION);
	if (diff === 0 && !force) return console.log(ok(`bond ${VERSION} ya es ${asked ? "esa versión" : "la última"}`));
	if (diff < 0 && !asked) return console.log(ok(`bond ${VERSION} es más nuevo que la última release (${want})`));
	console.log(`bond ${VERSION} → ${want.slice(1)}`);
	if (check) return;

	const method = installMethod();
	if (method !== "binary") return console.log(manualCommand(method, asked ? want.slice(1) : "latest"));

	const exe = process.execPath;
	try {
		assertWritable(exe);
		if (isDryRun()) return console.log(dim(`  [dry-run] descargaría ${assetName()} de ${want}, comprobaría su SHA-256 y sustituiría ${exe}`));
		await installBinary(want, exe);
	} catch (e) {
		die((e as Error).message);
	}
	console.log(ok("listo"));
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
		console.error(`${caution("bond")} ${version} disponible (tienes ${VERSION}): bond update`);
		return "informed";
	}
	console.log(`\nHay una versión nueva de bond: ${VERSION} → ${version}`);
	console.log("  1) Actualizar ahora");
	console.log(`  2) Omitir la ${version} (avisaré de la siguiente)`);
	console.log("  3) No volver a preguntar");
	const answer = (await (o.ask ?? askLine)("Elige [Intro: ahora no]: ")).trim();
	if (answer === "2") {
		record.skipped = latest;
		saveState(state);
		console.log(dim(`  No volveré a nombrar la ${version}.`));
		return "skip";
	}
	if (answer === "3") {
		setUpdateAuto(false);
		console.log(dim("  No volveré a preguntar ([update] auto = false en ~/.bond/config.toml). bond update sigue a mano."));
		return "never";
	}
	if (answer !== "1") return "later";

	const method = o.method ?? installMethod();
	if (method !== "binary") {
		console.log(manualCommand(method, version));
		return "manual";
	}
	try {
		await installBinary(latest, o.exe ?? process.execPath, o.base ?? releases());
		return "updated";
	} catch (e) {
		warn(`no he actualizado: ${(e as Error).message}. Sigues con bond ${VERSION}.`);
		return "failed";
	}
}
