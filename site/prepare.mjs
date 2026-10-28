// Copia las páginas de ../docs a ./src antes de construir el site: VitePress resuelve sus
// dependencias (vue) desde la carpeta de cada página, y node_modules está aquí, no en docs/.
// La fuente sigue siendo docs/; src/ se regenera y no se versiona. Fuera, los planes y la
// memoria de decisiones (docs/decisions/): son registros del proyecto, no documentación.
//
// puesto.md se publica como workstation.md, igual que su versión en inglés (docs/en/), para que
// el selector de idioma lleve a la misma página; sus enlaces se corrigen al copiar.

import { cpSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const src = join(here, "src");

rmSync(src, { recursive: true, force: true });
cpSync(docs, src, {
	recursive: true,
	filter: (p) => !(p.startsWith(join(docs, "plans")) || p.startsWith(join(docs, "decisions")) || /^plan-.*\.md$/.test(basename(p))),
});
renameSync(join(src, "puesto.md"), join(src, "workstation.md"));
for (const f of readdirSync(src).filter((f) => f.endsWith(".md"))) {
	const p = join(src, f);
	writeFileSync(p, readFileSync(p, "utf8").replace(/\]\(puesto\.md/g, "](workstation.md"));
}
console.log(`docs/ → site/src/`);
