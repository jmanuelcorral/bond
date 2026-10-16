// Claves de los endpoints: un fichero por proveedor en ~/.bond/keys/<id>, con permisos 600 y
// nunca dentro de un proyecto. Los agentes no las copian: las leen al usarlas.
//   pi       apiKey "!bond key <id>"
//   opencode settings.apiKey "{file:~/.bond/keys/<id>}"
//   Crush    --api-key "$(bond key <id>)"
//   Codex, Copilot: variable de entorno que pone `bond run`.

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BOND_HOME } from "./runtime.mts";
import { die } from "./util.mts";

export const KEYS_DIR = join(BOND_HOME, "keys");
export const keyPath = (id: string) => join(KEYS_DIR, id);

export function saveKey(id: string, key: string): void {
	mkdirSync(KEYS_DIR, { recursive: true });
	if (process.platform !== "win32") chmodSync(KEYS_DIR, 0o700);
	writeFileSync(keyPath(id), key.trim(), { mode: 0o600 });
	if (process.platform !== "win32") chmodSync(keyPath(id), 0o600);
}

export function readKey(id: string): string | undefined {
	try {
		return readFileSync(keyPath(id), "utf8").trim();
	} catch {
		return undefined;
	}
}

export const hasKey = (id: string) => existsSync(keyPath(id));
export const deleteKey = (id: string) => rmSync(keyPath(id), { force: true });

/** `bond key <id>`: imprime la clave (para los agentes que la leen con un comando). */
export function keyCommand(args: string[]): void {
	const [id] = args;
	if (!id) die("uso: bond key <proveedor>", 2);
	const key = readKey(id);
	if (key === undefined) die(`no hay clave guardada para '${id}' (bond setup)`);
	process.stdout.write(key);
}
