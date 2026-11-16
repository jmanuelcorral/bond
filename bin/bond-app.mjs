#!/usr/bin/env node
// Shim de bond-app: localiza @jmanuelcorral/bond-app/bin/bond-app.js y le cede el proceso.
// Se instala como el bin "bond-app" (aquí en el repo y en el paquete de npm generado
// por scripts/build.mts, que copia este fichero).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

function findBondApp() {
	try {
		return require.resolve("@jmanuelcorral/bond-app/bin/bond-app.js");
	} catch {}
	const candidates = [
		join(here, "..", "node_modules", "@jmanuelcorral", "bond-app", "bin", "bond-app.js"),
		join(here, "..", "..", "bond-app", "bin", "bond-app.js"), // layout del hub bond
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	console.error("bond-app no encontrado. Instala @jmanuelcorral/bond-app o ejecuta bond desde el hub.");
	process.exit(1);
}

const child = spawn(process.execPath, [findBondApp(), ...process.argv.slice(2)], {
	stdio: "inherit",
});
child.on("error", (err) => {
	console.error(`No se pudo arrancar bond-app: ${err.message}`);
	process.exit(1);
});
// Reenviamos las señales al hijo; al terminar por señal, reproducimos la señal en
// nosotros para que el proceso de control (terminal, herdr) vea el mismo resultado.
for (const sig of ["SIGINT", "SIGTERM"]) {
	process.on(sig, () => child.kill(sig));
}
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	process.exit(code ?? 0);
});
