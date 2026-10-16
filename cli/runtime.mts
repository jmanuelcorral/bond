// Dónde están los ficheros de bond (catálogo, skills, Bond Extensions, scripts) y su versión.
//
// - Desde el código fuente (el repo clonado): el propio repo.
// - Desde el binario compilado o el paquete de npm: los ficheros van dentro (cli/assets.gen.mts,
//   lo genera scripts/build.mts) y se extraen una vez en ~/.bond/runtime/<versión>/, porque los
//   agentes los leen por ruta. Cada versión trae los suyos: actualizar es cambiar el binario.

import { chmodSync, existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { REPO_DIR } from "./util.mts";

export const VERSION = pkg.version as string;

/** Configuración y datos globales de bond: nunca dentro de un proyecto. */
export const BOND_HOME = process.env.BOND_HOME || join(homedir(), ".bond");

/** ¿Se ejecuta desde un repo de bond en disco (y no desde el binario o el paquete de npm)? */
export const FROM_SOURCE =
	process.env.BOND_FORCE_RUNTIME !== "1" && !REPO_DIR.includes("$bunfs") && existsSync(join(REPO_DIR, "catalog")) && existsSync(join(REPO_DIR, "cli"));

let extracted: string | undefined;

/** Ruta a un fichero de bond. Desde el binario, exige haber llamado antes a assetsDir() (lo hace main). */
export function assetsPath(...parts: string[]): string {
	if (FROM_SOURCE) return join(REPO_DIR, ...parts);
	if (!extracted) throw new Error("bond: ficheros sin extraer (falta await assetsDir())");
	return join(extracted, ...parts);
}

/** Carpeta con los ficheros de bond: el repo, o los extraídos del binario. */
export async function assetsDir(): Promise<string> {
	if (FROM_SOURCE) return REPO_DIR;
	if (extracted) return extracted;
	const dir = join(BOND_HOME, "runtime", VERSION);
	if (!existsSync(join(dir, ".complete"))) {
		const { ASSETS } = (await import("./assets.gen.mts")) as { ASSETS: Record<string, { mode: number; b64: string }> };
		// Se extrae en una carpeta temporal y se renombra al final: nunca queda a medias.
		const tmp = `${dir}.tmp-${process.pid}`;
		rmSync(tmp, { recursive: true, force: true });
		for (const [rel, f] of Object.entries(ASSETS)) {
			const p = join(tmp, rel);
			mkdirSync(dirname(p), { recursive: true });
			writeFileSync(p, Buffer.from(f.b64, "base64"));
			if (process.platform !== "win32") chmodSync(p, f.mode);
		}
		writeFileSync(join(tmp, ".complete"), `${VERSION}\n`);
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dirname(dir), { recursive: true });
		renameSync(tmp, dir);
	}
	extracted = dir;
	return dir;
}

/**
 * ~/.bond/pi: enlace estable al paquete de pi de bond (Bond Extensions) de la versión instalada.
 * Los repos lo declaran en .pi/settings.json como "~/.bond/pi", así la ruta sirve en cualquier
 * máquina y no cambia al actualizar bond. En Windows es una junction (no pide permisos).
 */
export async function ensureBondLink(): Promise<string> {
	const target = await assetsDir();
	const link = join(BOND_HOME, "pi");
	let current: string | undefined;
	try {
		current = lstatSync(link).isSymbolicLink() ? readlinkSync(link) : "(no es un enlace)";
	} catch {
		// No existe.
	}
	if (current === target) return link;
	if (current !== undefined) rmSync(link, { recursive: false, force: true });
	mkdirSync(BOND_HOME, { recursive: true });
	symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
	return link;
}
