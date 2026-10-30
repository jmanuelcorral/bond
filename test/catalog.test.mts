// bond catalog (cli/catalog.mts): crear un catálogo en un repo y comprobarlo. Cada prueba
// trabaja en una carpeta temporal; bond se ejecuta desde el código fuente.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { catalogSlug, frontmatter, strictFrontmatter, validateCatalog } = await import("../cli/catalog.mts");

const ROOT = join(import.meta.dir, "..");
const MAIN = join(ROOT, "cli", "main.mts");
let base: string;
let dir: string;

beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "bond-catalog-")));
	dir = join(base, "Equipo Skills");
	mkdirSync(dir);
	spawnSync("git", ["init", "-q"], { cwd: dir });
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

const at = (p: string) => join(dir, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const write = (p: string, s: string) => {
	mkdirSync(join(at(p), ".."), { recursive: true });
	writeFileSync(at(p), s);
};

/** Ejecuta bond en `cwd` sin terminal (stdin cerrado: no pregunta). */
function bond(args: string[], cwd = dir): { code: number; out: string; err: string } {
	const r = spawnSync(process.execPath, [MAIN, ...args], { cwd, env: { ...process.env, NO_COLOR: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	return { code: r.status ?? -1, out: r.stdout, err: r.stderr };
}

const SCAFFOLD = ["catalog.toml", "skills/README.md", "commands/README.md", "mcps/README.md"];

describe("bond catalog create", () => {
	test("prepara catalog.toml y las tres carpetas con su README", () => {
		const r = bond(["catalog", "create", "--name", "equipo"]);
		expect(r.code).toBe(0);
		for (const f of SCAFFOLD) expect(existsSync(at(f))).toBe(true);
		expect(read("catalog.toml")).toContain('name = "equipo"');
		expect(read("mcps/README.md")).toContain("${");
		expect(validateCatalog(dir)).toMatchObject({ name: "equipo", errors: [], warnings: [], skills: [], commands: [], mcps: [] });
	});

	test("sin --name ni terminal, el nombre sale de la carpeta", () => {
		expect(bond(["catalog", "create"]).code).toBe(0);
		expect(read("catalog.toml")).toContain('name = "equipo-skills"');
	});

	test("una segunda vez no cambia nada", () => {
		bond(["catalog", "create", "--name", "equipo"]);
		const before = SCAFFOLD.map(read);
		const r = bond(["catalog", "create", "--name", "otro"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("nada que añadir");
		expect(SCAFFOLD.map(read)).toEqual(before);
	});

	test("con catalog.toml, no lo toca y solo añade lo que falta", () => {
		write("catalog.toml", '# mío\nname = "mio"\n');
		write("skills/README.md", "mi README\n");
		const r = bond(["catalog", "create", "--name", "otro"]);
		expect(r.code).toBe(0);
		expect(r.err).toContain("--name no lo cambia");
		expect(read("catalog.toml")).toBe('# mío\nname = "mio"\n');
		expect(read("skills/README.md")).toBe("mi README\n");
		expect(existsSync(at("commands/README.md"))).toBe(true);
		expect(existsSync(at("mcps/README.md"))).toBe(true);
		expect(r.out).toContain('Catálogo "mio"');
	});

	test("fuera de un repo git avisa y lo crea igual", () => {
		const plain = join(base, "suelto");
		mkdirSync(plain);
		const r = bond(["catalog", "create", "--name", "suelto"], plain);
		expect(r.code).toBe(0);
		expect(r.err).toContain("no es un repo git");
		expect(existsSync(join(plain, "catalog.toml"))).toBe(true);
	});

	test("--dry-run no escribe", () => {
		const r = bond(["catalog", "create", "--name", "equipo", "--dry-run"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("crearía catalog.toml");
		expect(existsSync(at("catalog.toml"))).toBe(false);
	});

	test("rechaza un nombre no válido", () => {
		const r = bond(["catalog", "create", "--name", "Mi Equipo"]);
		expect(r.code).toBe(1);
		expect(existsSync(at("catalog.toml"))).toBe(false);
	});

	test("en el repo del catálogo bond init y sync funcionan y no tocan el catálogo", () => {
		bond(["catalog", "create", "--name", "equipo"]);
		write("skills/revisar/SKILL.md", "---\nname: revisar\ndescription: Revisar algo\n---\n");
		const before = [...SCAFFOLD, "skills/revisar/SKILL.md"].map(read);
		expect(bond(["init", "--agents", "claude,codex,opencode"]).code).toBe(0);
		expect(bond(["sync", "--check"]).code).toBe(0);
		expect([...SCAFFOLD, "skills/revisar/SKILL.md"].map(read)).toEqual(before);
		expect(existsSync(at(".bond/bond.toml"))).toBe(true);
		expect(bond(["catalog", "check"]).code).toBe(0);
	});
});

describe("bond catalog check", () => {
	beforeEach(() => {
		bond(["catalog", "create", "--name", "equipo"]);
	});

	test("un catálogo correcto, con sus README, pasa", () => {
		write("skills/revisar/SKILL.md", "---\nname: revisar\ndescription: >\n  Revisar algo\n  en dos líneas\n---\n# Revisar\n");
		write("skills/revisar/references/detalle.md", "detalle\n");
		write("commands/notas.md", "---\ndescription: Notas de la release\nargument-hint: \"[versión]\"\n---\nNotas de $1\n");
		write("mcps/db.json", JSON.stringify({ command: "npx", args: ["-y", "srv@1.0.0", "${DATABASE_URL}"], env: { TOKEN: "${DB_TOKEN}" }, description: "Base de datos" }));
		write("mcps/docs.json", JSON.stringify({ url: "https://x/mcp", headers: { Authorization: "Bearer ${T}" }, description: "Docs" }));
		write("catalog.toml", 'name = "equipo"\n[skills.revisar]\nsummary = "Revisar"\ndefault = false\n');
		const r = bond(["catalog", "check"]);
		expect(r.code).toBe(0);
		expect(r.out).toContain("1 skill, 1 comando, 2 servidores MCP");
		expect(r.err).toBe("");
	});

	test("cada error, con su motivo, y sale con 1", () => {
		write("skills/sin-skill/notas.md", "x\n");
		write("skills/mal-nombre/SKILL.md", "---\nname: otro\ndescription: x\n---\n");
		write("skills/sin-desc/SKILL.md", "---\nname: sin-desc\n---\n");
		write("commands/vacio.md", "Sin frontmatter\n");
		write("mcps/roto.json", "{ no es json");
		write("mcps/nada.json", JSON.stringify({ description: "x" }));
		write("mcps/args.json", JSON.stringify({ command: "x", args: "y", description: "x" }));
		write("catalog.toml", 'name = "equipo"\n[skills.fantasma]\nsummary = "x"\n');
		const r = bond(["catalog", "check"]);
		expect(r.code).toBe(1);
		for (const msg of [
			"skills/sin-skill: falta SKILL.md",
			'skills/mal-nombre/SKILL.md: name "otro"',
			"skills/sin-desc/SKILL.md: falta description",
			"commands/vacio.md: falta description",
			"mcps/roto.json: JSON inválido",
			"mcps/nada.json: necesita command",
			"mcps/args.json: args tiene que ser una lista",
			"[skills.fantasma] no corresponde",
		])
			expect(r.err).toContain(msg);
		expect(r.err).toContain("8 errores");
	});

	test("un secreto escrito tal cual es un aviso, no un error", () => {
		write("mcps/db.json", JSON.stringify({ command: "x", env: { API_KEY: "abc123" }, description: "x" }));
		const r = bond(["catalog", "check"]);
		expect(r.code).toBe(0);
		expect(r.err).toContain("env.API_KEY parece un secreto");
		expect(r.out).toContain("0 skills, 0 comandos, 1 servidor MCP, 1 aviso");
	});

	test("frontmatter con YAML inválido: error claro, con línea y arreglo (D16)", () => {
		write("skills/rota/SKILL.md", "---\nname: rota\ndescription: Record decisions with git trailers (Agent: and Decision:) and runs.\n---\n# Rota\n");
		const r = bond(["catalog", "check"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("skills/rota/SKILL.md: frontmatter no es YAML válido");
		expect(r.err).toContain('línea 3: valor sin comillas en description contiene ": "');
		expect(r.err).toContain("entrecomillalo");
		// La misma skill entrecomillada pasa.
		write("skills/rota/SKILL.md", '---\nname: rota\ndescription: "Record decisions with git trailers (\\"Agent:\\" and \\"Decision:\\") and runs."\n---\n# Rota\n');
		const ok = bond(["catalog", "check"]);
		expect(ok.code).toBe(0);
	});

	test("sin catalog.toml no es un catálogo", () => {
		rmSync(at("catalog.toml"));
		const r = bond(["catalog", "check"]);
		expect(r.code).toBe(1);
		expect(r.err).toContain("falta catalog.toml");
	});

	test("admite otro directorio", () => {
		const r = bond(["catalog", "check", join(ROOT, "catalog")], base);
		expect(r.code).toBe(0);
		expect(r.out).toContain('"bond"');
	});
});

describe("el catálogo de bond", () => {
	test("sigue el formato de los catálogos", () => {
		const r = validateCatalog(join(ROOT, "catalog"));
		expect(r.errors).toEqual([]);
		expect(r.warnings).toEqual([]);
		expect(r.name).toBe("bond");
		expect(r.mcps).toEqual(["context7", "duckduckgo"]);
	});

	test("las skills globales de bond (las que enlaza bond setup) tienen frontmatter que pi carga", () => {
		// pi no carga una skill con frontmatter inválido: p. ej. un ": " sin comillas en la description.
		const dir = join(ROOT, "global", "skills");
		for (const name of readdirSync(dir)) {
			expect({ name, errors: strictFrontmatter(readFileSync(join(dir, name, "SKILL.md"), "utf8")) }).toEqual({ name, errors: [] });
		}
	});
});

describe("ayudantes", () => {
	test("strictFrontmatter: YAML simple, comillas, bloques y comentarios pasan", () => {
		expect(strictFrontmatter('---\nname: x\ndescription: "a: b"\n---\n')).toEqual([]);
		expect(strictFrontmatter("---\nname: x\ndescription: |\n  texto con: de todo\n  incluso esto: sí\n---\n")).toEqual([]);
		expect(strictFrontmatter("---\n# comentario\nname: x\ndescription: y z\n---\n")).toEqual([]);
		expect(strictFrontmatter("---\nname: x\nuser-invocable: true\n---\n")).toEqual([]);
	});

	test("strictFrontmatter: lo que pi rechaza, con la línea señalada", () => {
		const errs = strictFrontmatter("---\nname: x\ndescription: trailers (Agent: and Decision:) here.\n---\n");
		expect(errs.length).toBe(1);
		expect(errs[0]).toContain("línea 3");
		expect(errs[0]).toContain("description");
		expect(strictFrontmatter("---\nname: x:\n---\n")[0]).toContain("línea 2");
		expect(strictFrontmatter("---\nsin clave esta línea\n---\n")[0]).toContain('no es "clave: valor"');
		expect(strictFrontmatter("---\ndescription: \"sin cerrar\n---\n")[0]).toContain("comilla sin cerrar");
		expect(strictFrontmatter("sin frontmatter")[0]).toContain("sin frontmatter");
	});

	test("frontmatter: una línea, comillas y bloques", () => {
		expect(frontmatter('---\nname: x\ndescription: "hola"\n---\n')).toEqual({ name: "x", description: "hola" });
		expect(frontmatter("---\ndescription: |\n  uno\n  dos\nname: y\n---\n")).toEqual({ description: "uno dos", name: "y" });
		expect(frontmatter("sin frontmatter")).toBeUndefined();
	});

	test("catalogSlug", () => {
		expect(catalogSlug("Equipo Skills")).toBe("equipo-skills");
		expect(catalogSlug("Catálogo_ÑU")).toBe("catalogo_nu");
		expect(catalogSlug("!!!")).toBe("catalogo");
	});
});
