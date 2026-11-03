// Idioma del texto que bond GENERA EN FICHERS para los agente (issue #49, decisiones G1-G4).
// No es consola: son las reglas globales, el bloque bond:hub y la nota de coordinacion.
//
// Cada prueba fija el idioma con setLang() y lo restaura: el idioma es estado global del
// proceso y el resto de la suite espera el fijado por test/lang-pinned.mts.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-gen-"));
const { syncRepo, hubAgentsBlock, withBlock } = await import("../cli/repo.mts");
const { setLang, t } = await import("../cli/messages.mts");
const { ensurePersonal, PERSONAL_FILE } = await import("../cli/instructions.mts");
const { verticalNote } = await import("../cli/team.mts");

const origCwd = process.cwd();
const pinnedLang = t("gen.hub_title").includes("El hub") ? "es" : "en";
let repo: string;

beforeEach(() => {
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-gen-")));
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: repo });
	process.chdir(repo);
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(repo, { recursive: true, force: true });
	// BOND_HOME se crea una sola vez al cargar el fichero: PERSONAL_FILE sobrevive entre pruebas
	// si no se borra, y la prueba siguiente veria el idioma de la anterior.
	rmSync(PERSONAL_FILE, { force: true });
	setLang(pinnedLang as "es" | "en");
});

const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const write = (p: string, s: string) => {
	mkdirSync(at(p + "/.."), { recursive: true });
	writeFileSync(at(p), s);
};
const json = (p: string) => JSON.parse(read(p));

const bondToml = () =>
	write(".bond/bond.toml", `agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n`);

const hubToml = () =>
	write("hub.toml", `name = "hub"\nbase = "main"\n[repos.front]\npath = "front"\nbase = "main"\nlink = "submodule"\n`);

const sync = (opts: { check?: boolean; force?: boolean } = {}) => syncRepo({ ...opts });

/** Captura lo que bond dice por consola durante fn(). */
function spoken(fn: () => void): string {
	const lines: string[] = [];
	const real = console.log;
	console.log = (...a: unknown[]) => void lines.push(a.join(" "));
	try {
		fn();
	} finally {
		console.log = real;
	}
	return lines.join("\n");
}

describe("el manifiesto recuerda el idioma de los bloques (G2)", () => {
	test("sync guarda el idioma en vigor en manifest.lang", () => {
		bondToml();
		hubToml();
		setLang("es");
		sync();
		expect(json(".bond/manifest.json").lang).toBe("es");
		setLang("en");
		sync();
		expect(json(".bond/manifest.json").lang).toBe("en");
	});

	test("un manifiesto viejo sin lang no dispara el aviso (retrocompatible)", () => {
		bondToml();
		hubToml();
		setLang("es");
		sync();
		const m = json(".bond/manifest.json");
		delete m.lang;
		write(".bond/manifest.json", JSON.stringify(m, null, 2) + "\n");
		setLang("en");
		const out = spoken(() => sync());
		// Reescribe el bloque (cambio real de idioma) pero no afirma cuantos venian de donde.
		expect(out).not.toContain("idioma cambiado a");
		expect(read("AGENTS.md")).toContain("The hub: session and rules");
	});
});

describe("cambiar de idioma se avisa, no se diluye (G2)", () => {
	test("sync avisa con cuantos bloques reescribe y a que idioma", () => {
		bondToml();
		hubToml();
		setLang("es");
		sync();
		expect(read("AGENTS.md")).toContain("El hub: sesión y reglas");
		setLang("en");
		const out = spoken(() => sync());
		expect(out).toContain("language switched to en");
		expect(out).toContain("(1)");
		expect(read("AGENTS.md")).toContain("The hub: session and rules");
		expect(read("AGENTS.md")).not.toContain("El hub: sesión y reglas");
	});

	test("--check lo distingue de un bloque desactualizado generico", () => {
		bondToml();
		hubToml();
		setLang("es");
		sync();
		setLang("en");
		const out = spoken(() => sync({ check: true }));
		expect(out).toContain("block in es, current language en");
		expect(out).toContain("AGENTS.md");
		// Y en el mismo idioma no se marca nada de esto. Ojo: --check no escribe el manifiesto,
		// asi que repetir --check reporta el mismo cambio pendiente (es lo que debe hacer).
		// Para esto hay que aplicar primero.
		sync();
		const same = spoken(() => sync({ check: true }));
		expect(same).not.toContain("current language");
	});

	test("un bloque que cambia por otra cosa no se cuenta como cambio de idioma", () => {
		bondToml();
		hubToml();
		setLang("es");
		sync();
		// Mismo idioma, pero el bloque se corrompe: no es cambio de idioma.
		write("AGENTS.md", read("AGENTS.md").replace("El hub: sesión y reglas", "El hub: MANTEADO"));
		const out = spoken(() => sync());
		expect(out).not.toContain("idioma cambiado a");
		expect(out).not.toContain("language switched to");
	});
});

describe("caminos y comandos no se traducen (G4)", () => {
	const LITERALS = ["docs/plans/", "docs/decisions/", "hub.toml", "repos/", "bond team", "bond hub check", "bond hub sync", "bond sync"];

	test("en español", () => {
		setLang("es");
		const b = hubAgentsBlock({ name: "hub", repos: [{ path: ".", base: "main" }, { path: "front", base: "main", link: "submodule" }] } as never, "docs/decisions");
		for (const lit of LITERALS) expect(b).toContain(lit);
	});

	test("en ingles", () => {
		setLang("en");
		const b = hubAgentsBlock({ name: "hub", repos: [{ path: ".", base: "main" }, { path: "front", base: "main", link: "submodule" }] } as never, "docs/decisions");
		for (const lit of LITERALS) expect(b).toContain(lit);
		// Y las cabeceras de tabla, esas si, van en el idioma.
		expect(b).toContain("| REPO | PATH | BASE | LINK | AGENT | DESCRIPTION |");
		expect(b).not.toContain("RUTA");
		expect(b).not.toContain("ENLACE");
	});
});

describe("~/.bond/AGENTS.md no se migra (G3)", () => {
	test("si existe, cambiar de idioma no lo toca", () => {
		setLang("es");
		ensurePersonal();
		const seeded = readFileSync(PERSONAL_FILE, "utf8");
		// PERSONAL_FILE es una ruta absoluta fuera del repo: va escrita directa, no por at().
		writeFileSync(PERSONAL_FILE, "# mis cosas personales\n");
		setLang("en");
		ensurePersonal();
		expect(readFileSync(PERSONAL_FILE, "utf8")).toBe("# mis cosas personales\n");
		expect(seeded).toContain("# Mis instrucciones para todos los agentes");
	});

	test("si no existe, se siembra en el idioma en vigor", () => {
		setLang("en");
		ensurePersonal();
		expect(readFileSync(PERSONAL_FILE, "utf8")).toContain("# My instructions for all agents");
		rmSync(PERSONAL_FILE, { force: true });
		setLang("es");
		ensurePersonal();
		expect(readFileSync(PERSONAL_FILE, "utf8")).toContain("# Mis instrucciones para todos los agentes");
	});
});

describe("nota de coordinacion en los dos idiomas", () => {
	const team = [
		{ name: "pi/uno", repo: "api", path: "repos/api" },
		{ name: "pi/dos", repo: "web", path: "repos/web" },
	];

	test("acompanado", () => {
		setLang("es");
		expect(verticalNote("h", "f/x", { name: "pi/uno", repo: "api" }, team as never)).toContain("En la misma rama: pi/dos en web (repos/web)");
		setLang("en");
		expect(verticalNote("h", "f/x", { name: "pi/uno", repo: "api" }, team as never)).toContain("On the same branch: pi/dos in web (repos/web)");
	});

	test("unico agente de la rama", () => {
		setLang("es");
		expect(verticalNote("h", "f/x", { name: "pi/uno", repo: "api" }, [team[0]] as never)).toContain("Eres el único agente de la rama.");
		setLang("en");
		expect(verticalNote("h", "f/x", { name: "pi/uno", repo: "api" }, [team[0]] as never)).toContain("You are the only agent on the branch.");
	});
});

describe("el espanol no cambia de lo que ya se escribia (regresion)", () => {
	test("las reglas globales conservan el texto de antes de i18n", () => {
		setLang("es");
		const r = t("gen.rules");
		expect(r.startsWith("## Bond: Herdr y otros agentes\n")).toBe(true);
		expect(r).toContain("- No mandes código ni datos privados a búsquedas web: busca el mensaje de error, no el fichero.");
		expect(r).toContain("`Agent:` y `Decision:` en los commits.");
	});

	test("las notas del marcador no dependen del idioma", () => {
		// Es lo que hace que lo commiteado sea estable entre maquinas: si la nota siguiera el
		// idioma, un runner que detecta en contra un bloque commiteado en es y `sync --check`
		// falla sin que nadie haya elegido idioma.
		setLang("es");
		const a = withBlock("", "cuerpo", "md");
		setLang("en");
		const b = withBlock("", "cuerpo", "md");
		expect(b).toBe(a);
		expect(a).toContain("generado por `bond sync`; no editar");
	});
});

describe("los dos catalogos dicen lo mismo", () => {
	test("toda clave gen.* tiene traducción y no esta vacia", () => {
		for (const key of ["gen.rules", "gen.personal_template", "gen.hub_title", "gen.hub_intro", "gen.hub_repos_title", "gen.hub_is_hub", "gen.hub_link_submodule", "gen.hub_col_repo", "gen.hub_col_path", "gen.hub_col_base", "gen.hub_col_link", "gen.hub_col_agent", "gen.hub_col_description", "gen.hub_rules_title", "gen.hub_rule_no_edit", "gen.hub_rule_coordinate", "gen.hub_rule_check", "gen.vertical_head", "gen.vertical_alone", "gen.vertical_others", "gen.vertical_other_entry", "gen.lang_rewritten", "gen.lang_check"]) {
			setLang("es");
			const es = t(key as never);
			setLang("en");
			const en = t(key as never);
			expect(es.trim().length > 0).toBe(true);
			expect(en.trim().length > 0).toBe(true);
			// Una traduccion que copia el original delata que no se tradujo. Se excluyen los
			// literales que son iguales en los dos idiomas: cabeceras que ya son anglicismos y
			// el nombre tecnico del tipo de enlace.
			const SAME_IN_BOTH = ["gen.hub_col_repo", "gen.hub_col_base", "gen.hub_link_submodule"];
			if (!SAME_IN_BOTH.includes(key)) expect(en).not.toBe(es);
		}
	});
});
