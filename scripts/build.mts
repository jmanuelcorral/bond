// Construye bond para distribuir:
//   dist/bond-<plataforma>[.exe]   binarios autocontenidos (bun build --compile)
//   dist/npm/                      paquete de npm: JavaScript para Node >= 22, sin binario
//
// Antes genera cli/assets.gen.mts con los ficheros que bond necesita en disco (catálogo, skills
// globales, Bond Extensions, scripts), que el binario extrae en ~/.bond/runtime/<versión>/.
//
// Uso: bun scripts/build.mts [--targets linux-x64,darwin-arm64,...] [--no-npm]

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const ALL_TARGETS = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"];

// Lo que va dentro: rutas relativas a la raíz del repo (carpetas completas o ficheros).
const ASSET_PATHS = [
	"package.json", // manifiesto del paquete de pi (Bond Extensions)
	"catalog",
	"global",
	"extensions",
	"lib",
	"prompts",
	"templates", // plantillas de bond catalog create
	"herdr/config.snippet.toml",
];

function walk(p: string): string[] {
	return statSync(p).isDirectory() ? readdirSync(p).flatMap((e) => walk(join(p, e))) : [p];
}

function generateAssets(): number {
	const assets: Record<string, { mode: number; b64: string }> = {};
	for (const rel of ASSET_PATHS) {
		for (const f of walk(join(ROOT, rel))) {
			assets[relative(ROOT, f).split("\\").join("/")] = { mode: statSync(f).mode & 0o777, b64: readFileSync(f).toString("base64") };
		}
	}
	const out = `// Generado por scripts/build.mts: no editar ni versionar.\nexport const ASSETS: Record<string, { mode: number; b64: string }> = ${JSON.stringify(assets)};\n`;
	writeFileSync(join(ROOT, "cli", "assets.gen.mts"), out);
	return Object.keys(assets).length;
}

async function run(cmd: string[]): Promise<void> {
	const p = Bun.spawn(cmd, { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
	if ((await p.exited) !== 0) throw new Error(`falló: ${cmd.join(" ")}`);
}

const args = process.argv.slice(2);
const ti = args.indexOf("--targets");
const targets = ti >= 0 ? args[ti + 1].split(",") : ALL_TARGETS;
for (const t of targets) if (!ALL_TARGETS.includes(t)) throw new Error(`plataforma desconocida: ${t} (${ALL_TARGETS.join(", ")})`);

const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const dist = join(ROOT, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log(`bond ${version}: ${generateAssets()} ficheros incrustados`);

for (const t of targets) {
	const out = join(dist, `bond-${t}${t.startsWith("windows") ? ".exe" : ""}`);
	await run(["bun", "build", "--compile", "--minify", `--target=bun-${t}`, "cli/main.mts", "--outfile", out]);
	console.log(`  ${relative(ROOT, out)}  ${(statSync(out).size / 1048576).toFixed(1)} MB`);
}

if (!args.includes("--no-npm")) {
	const npm = join(dist, "npm");
	mkdirSync(join(npm, "bin"), { recursive: true });
	await run(["bun", "build", "--target=node", "--format=esm", "cli/main.mts", "--outfile", join(npm, "bond.mjs")]);
	writeFileSync(join(npm, "bin", "bond.mjs"), `#!/usr/bin/env node\nimport "../bond.mjs";\n`);
	const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
	writeFileSync(
		join(npm, "package.json"),
		`${JSON.stringify(
			{
				name: "@jmanuelcorral/bond",
				version,
				description: pkg.description,
				license: pkg.license,
				type: "module",
				bin: { bond: "bin/bond.mjs" },
				engines: { node: ">=22" },
				repository: { type: "git", url: "https://github.com/jmanuelcorral/bond.git" },
				files: ["bond.mjs", "bin"],
			},
			null,
			2,
		)}\n`,
	);
	copyFileSync(join(ROOT, "README.md"), join(npm, "README.md"));
	console.log(`  dist/npm  (${(statSync(join(npm, "bond.mjs")).size / 1048576).toFixed(1)} MB)`);
}
