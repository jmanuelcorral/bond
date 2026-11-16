#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);

function findBondApp() {
	try {
		return require.resolve("@jmanuelcorral/bond-app/bin/bond-app.js");
	} catch {}
	const candidates = [
		new URL("../node_modules/@jmanuelcorral/bond-app/bin/bond-app.js", import.meta.url),
		new URL("../../@jmanuelcorral/bond-app/bin/bond-app.js", import.meta.url),
	];
	for (const candidate of candidates) {
		const p = fileURLToPath(candidate);
		if (existsSync(p)) return p;
	}
	throw new Error("@jmanuelcorral/bond-app no encontrado. Ejecuta: npm install -g @jmanuelcorral/bond-app");
}

const target = findBondApp();
const child = spawn(process.execPath, [target, ...process.argv.slice(2)], {
	stdio: "inherit",
});
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 0);
});
