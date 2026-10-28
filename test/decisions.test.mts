// bond decisions (cli/decisions.mts): la memoria de decisiones del repo. Cada prueba
// trabaja en un repo git temporal con [decisions]. Se ejecuta desde el código fuente,
// así que el catálogo y el README plantilla son los del repo.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
const { addDecision, checkDecisions, decisions, loadDecisions, parseFm, resolveAuthor, slugify } = await import("../cli/decisions.mts");
const { catchDie } = await import("../cli/util.mts");

const origCwd = process.cwd();
const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
let repo: string;

/** Lanza bond como proceso hijo sin Herdr: die() termina con código y mensaje en stderr. */
const bond = (args: string[], cwd = repo) =>
	spawnSync(process.execPath, [MAIN, ...args], {
		cwd,
		env: { ...process.env, NO_COLOR: "1", HERDR_ENV: "", HERDR_PANE_ID: "" },
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

beforeEach(() => {
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-dec-")));
	spawnSync("git", ["init", "-q"], { cwd: repo });
	process.chdir(repo);
	// Autoría determinista: fuera de Herdr es "user" (el caso de panel se comprueba a mano).
	delete process.env.HERDR_ENV;
	delete process.env.HERDR_PANE_ID;
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(repo, { recursive: true, force: true });
});

const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const write = (p: string, s: string) => {
	mkdirSync(join(at(p), ".."), { recursive: true });
	writeFileSync(at(p), s);
};

function enableMemory(dir = "docs/decisions"): void {
	write(".bond/bond.toml", `agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[decisions]\ndir = "${dir}"\n`);
}

const add = (over: Partial<Parameters<typeof addDecision>[2]> = {}) =>
	addDecision(repo, "docs/decisions", { title: "Preferir bun", decision: "Usar bun como runtime de pruebas.", ...over });

describe("add", () => {
	test("con solo título y decisión crea un fichero válido sin tocar el README (D19)", () => {
		enableMemory();
		const { id, rel } = add();
		expect(id).toBe(`${new Date().toISOString().slice(0, 10)}-preferir-bun`);
		expect(rel).toBe(`docs/decisions/${id}.md`);
		const fm = parseFm(read(rel));
		expect(fm?.scalars.status).toBe("proposed");
		expect(fm?.scalars.decided_by).toBe("user");
		expect(fm?.scalars.title).toBe("Preferir bun");
		expect(fm?.body).toContain("## Decision");
		// Sin índice compartido: add no crea ni reescribe el README; el listado lo da bond decisions.
		expect(existsSync(at("docs/decisions/README.md"))).toBe(false);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("lee decisiones con finales CRLF (checkout en Windows con core.autocrlf)", () => {
		enableMemory();
		const { rel } = add();
		writeFileSync(at(rel), read(rel).replace(/\n/g, "\r\n"));
		expect(parseFm(read(rel))?.scalars.status).toBe("proposed");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("con confirmed_by entra aceptada con la cita del usuario (aceptar al aprobar)", () => {
		enableMemory();
		const { rel, status } = add({ confirmed_by: " chat: «aprueba y guarda» " });
		expect(status).toBe("accepted");
		const fm = parseFm(read(rel));
		expect(fm?.scalars.status).toBe("accepted");
		expect(fm?.scalars.accepted_by).toBe("chat: «aprueba y guarda»");
		expect(fm?.scalars.accepted_via).toBe("user");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("confirmed_by en blanco se rechaza y sin él queda proposed", () => {
		enableMemory();
		expect(catchDie(() => add({ confirmed_by: "  " })).error).toContain("--confirmed-by");
		expect(add().status).toBe("proposed");
	});

	test("no repite un enlace que ya daba el agente", () => {
		enableMemory();
		const { rel } = add({ links: ["plan: docs/plans/x.md", "plan: docs/plans/x.md "] });
		expect(parseFm(read(rel))?.lists.links).toEqual(["plan: docs/plans/x.md"]);
	});

	test("dos add con el mismo título el mismo día dan <id> y <id>-2", () => {
		enableMemory();
		const a = add();
		const b = add();
		expect(b.id).toBe(`${a.id}-2`);
		expect(existsSync(at(b.rel))).toBe(true);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("enlaza rama y HEAD cuando el repo tiene commits", () => {
		enableMemory();
		write("a.txt", "x");
		spawnSync("git", ["add", "a.txt"], { cwd: repo });
		spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "inicio"], { cwd: repo });
		const { id } = add();
		const links = parseFm(read(`docs/decisions/${id}.md`))?.lists.links ?? [];
		expect(links.some((l) => l.startsWith("branch: "))).toBe(true);
		expect(links.some((l) => l.startsWith("head: "))).toBe(true);
	});

	test("funciona en un repo sin commits", () => {
		enableMemory();
		const { id } = add();
		const links = parseFm(read(`docs/decisions/${id}.md`))?.lists.links ?? [];
		expect(links).toEqual([]);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("los links del usuario se guardan tal cual", () => {
		enableMemory();
		const { id } = add({ links: ["plan: docs/plans/x.md#p2", "  ", "pr: https://github.com/o/r/pull/1"] });
		expect(parseFm(read(`docs/decisions/${id}.md`))?.lists.links).toEqual(["plan: docs/plans/x.md#p2", "pr: https://github.com/o/r/pull/1"]);
	});

	test("add no toca un README existente, ni con una tabla de índice vieja (D19)", () => {
		enableMemory();
		const before = "# Decisiones\n\n## Índice\n\n| ID | Estado | Quién | Fecha | Título |\n|---|---|---|---|---|\n| 2020-01-01-vieja | accepted | user | 2020-01-01 | Vieja |\n\nNota mía bajo la tabla.\n";
		write("docs/decisions/README.md", before);
		const { id } = add();
		expect(read("docs/decisions/README.md")).toBe(before);
		expect(existsSync(at(`docs/decisions/${id}.md`))).toBe(true);
		// Y check la ignora: una tabla desfasada ya no es un error de la memoria.
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("sin [decisions], add falla diciendo cómo activarla", () => {
		write(".bond/bond.toml", 'agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n');
		const r = bond(["decisions", "add", "--title", "x", "--decision", "y"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("[decisions]");
		expect(existsSync(at("docs/decisions"))).toBe(false);
	});

	test("add necesita título y decisión", () => {
		enableMemory();
		expect(catchDie(() => addDecision(repo, "docs/decisions", { title: "", decision: "d" } as never)).error).toContain("título");
		expect(catchDie(() => addDecision(repo, "docs/decisions", { title: "t", decision: "" } as never)).error).toContain("decisión");
	});
});

// P3: los apartados que escribe add tienen que coincidir con los que anuncian el README
// de decisionsReadme() y la plantilla de decision-record: en inglés, Consequences opcional.
describe("apartados del cuerpo (add / README / plantilla)", () => {
	const SECTIONS = ["Context", "Decision", "Rejected alternatives", "Consequences"];

	test("el README de decisionsReadme() anuncia los apartados en inglés que escribe add", async () => {
		const { decisionsReadme } = await import("../cli/repo.mts");
		const readme = decisionsReadme();
		for (const s of SECTIONS) expect(readme).toContain(`*${s}*`);
		expect(readme).not.toContain("*Contexto*");
		expect(readme).toContain("no es una medida de seguridad");
	});

	test("con consequences escribe los cuatro apartados y check lo da por válido", () => {
		enableMemory();
		const { rel } = add({ context: "c", alternatives: "a", consequences: "Migrar los planes a docs/decisions." });
		const body = parseFm(read(rel))!.body;
		const order = SECTIONS.map((s) => body.indexOf(`## ${s}`));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect(order).toEqual([...order].sort((x, y) => x - y));
		expect(body).toContain("Migrar los planes a docs/decisions.");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("sin consequences no aparece el apartado Consequences", () => {
		enableMemory();
		const { rel } = add({ context: "c", alternatives: "a" });
		const body = parseFm(read(rel))!.body;
		expect(body).toContain("## Rejected alternatives");
		expect(body).not.toContain("## Consequences");
	});

	test("el CLI acepta --consequences y escribe el apartado", () => {
		enableMemory();
		const r = bond(["decisions", "add", "--title", "Con sec", "--decision", "d", "--consequences", "Consecuencia tal"]);
		expect(r.status).toBe(0);
		const ds = loadDecisions(repo, "docs/decisions");
		expect(ds).toHaveLength(1);
		expect(ds[0].body).toContain("## Consequences");
		expect(ds[0].body).toContain("Consecuencia tal");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("add --stdin acepta consequences en el JSON", () => {
		enableMemory();
		const r = spawnSync(process.execPath, [MAIN, "decisions", "add", "--stdin", "--json"], {
			cwd: repo,
			input: JSON.stringify({ title: "stdin con sec", decision: "d", consequences: "Via stdin" }),
			encoding: "utf8",
			timeout: 30_000,
			env: { ...process.env, NO_COLOR: "1", HERDR_ENV: "", HERDR_PANE_ID: "" },
		});
		expect(r.status).toBe(0);
		const ds = loadDecisions(repo, "docs/decisions");
		expect(ds).toHaveLength(1);
		expect(ds[0].body).toContain("## Consequences");
		expect(ds[0].body).toContain("Via stdin");
	});
});

describe("autoría (D12)", () => {
	test("fuera de Herdr es user", () => {
		expect(resolveAuthor()).toBe("user");
	});

	test("en Herdr sin agente en el panel, user", () => {
		process.env.HERDR_ENV = "1";
		process.env.HERDR_PANE_ID = "pane-que-no-existe-9999";
		expect(resolveAuthor()).toBe("user");
		delete process.env.HERDR_ENV;
		delete process.env.HERDR_PANE_ID;
	});
});

describe("accept sin TTY (D13)", () => {
	test("se niega y no cambia nada", () => {
		enableMemory();
		const { id } = add();
		const before = read(`docs/decisions/${id}.md`);
		// Con stdio en tubería la entrada no es terminal: es el caso del shell de un agente.
		const r = bond(["decisions", "accept", id]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("terminal interactiva");
		expect(read(`docs/decisions/${id}.md`)).toBe(before);
	});
});

// Con terminal (pseudo-tty de `script`) se comprueba la confirmación: solo con "y" cambia.
// Solo Linux: `script -qec` es de util-linux; el `script` de macOS (BSD) tiene otra sintaxis y
// no da terminal con la entrada por tubería, y en Windows no hay. El caso sin TTY, de arriba,
// se prueba en todos.
(process.platform === "linux" ? describe : describe.skip)("accept con TTY (D13)", () => {
	const withTty = (args: string[], answer: string) => {
		const cmd = [process.execPath, MAIN, "decisions", ...args].map((s) => (/[ \t]/.test(s) ? `'${s}'` : s)).join(" ");
		return spawnSync("script", ["-qec", cmd, "/dev/null"], {
			cwd: repo,
			input: answer,
			encoding: "utf8",
			env: { ...process.env, NO_COLOR: "1", HERDR_ENV: "", HERDR_PANE_ID: "" },
		});
	};

	test("con \"y\" pasa a accepted sin escribir ningún índice (D19)", () => {
		enableMemory();
		const { id } = add();
		const r = withTty(["accept", id, "--ref", "sesion de prueba"], "y\n");
		expect(r.status).toBe(0);
		const fm = parseFm(read(`docs/decisions/${id}.md`));
		expect(fm?.scalars.status).toBe("accepted");
		expect(fm?.scalars.accepted_by).toBe("sesion de prueba");
		expect(existsSync(at("docs/decisions/README.md"))).toBe(false);
	});

	test("con \"n\" no cambia nada", () => {
		enableMemory();
		const { id } = add();
		const before = read(`docs/decisions/${id}.md`);
		const r = withTty(["reject", id], "n\n");
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("cancelado");
		expect(read(`docs/decisions/${id}.md`)).toBe(before);
	});
});

describe("check", () => {
	const broken = (name: string, body: string) => `docs/decisions/${name}.md`;

	test("detecta status inválido", () => {
		enableMemory();
		write(broken("2026-01-01-a", ""), `---\nid: "2026-01-01-a"\ntitle: "t"\nstatus: "final"\ndate: "2026-01-01"\ndecided_by: "user"\n---\n`);
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("status") && e.includes("2026-01-01-a"))).toBe(true);
	});

	test("detecta id que no coincide con el fichero", () => {
		enableMemory();
		write(broken("2026-01-01-a", ""), `---\nid: "2026-01-01-otra"\ntitle: "t"\nstatus: "proposed"\ndate: "2026-01-01"\ndecided_by: "user"\n---\n`);
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("no coincide"))).toBe(true);
	});

	test("detecta ids duplicadas", () => {
		enableMemory();
		const fm = (id: string, f: string) => `---\nid: "${id}"\ntitle: "t"\nstatus: "proposed"\ndate: "2026-01-01"\ndecided_by: "user"\n---\n`;
		write(broken("2026-01-01-a", ""), fm("2026-01-01-a", "a"));
		write(broken("2026-01-01-b", ""), fm("2026-01-01-a", "b"));
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("duplicada"))).toBe(true);
	});

	test("detecta superseded_by que no existe", () => {
		enableMemory();
		write(broken("2026-01-01-a", ""), `---\nid: "2026-01-01-a"\ntitle: "t"\nstatus: "superseded"\ndate: "2026-01-01"\ndecided_by: "user"\nsuperseded_by: "2026-01-02-fantasma"\n---\n`);
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("superseded_by") && e.includes("no existe"))).toBe(true);
	});

	test("detecta un fichero sin frontmatter", () => {
		enableMemory();
		write(broken("2026-01-01-a", ""), "# solo texto\n");
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("frontmatter"))).toBe(true);
	});

	test("detecta trailers Decision: que no apuntan a nada", () => {
		enableMemory();
		add();
		spawnSync("git", ["add", "-A"], { cwd: repo });
		spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "aplica algo\n\nDecision: 1999-01-01-no-existe"], { cwd: repo });
		expect(checkDecisions(repo, "docs/decisions").errors.some((e) => e.includes("Decision:") && e.includes("1999-01-01-no-existe"))).toBe(true);
	});

	test("un trailer Decision: válido no da error", () => {
		enableMemory();
		const { id } = add();
		spawnSync("git", ["add", "-A"], { cwd: repo });
		spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", `aplica lo suyo\n\nDecision: ${id}`], { cwd: repo });
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("no mira los trailers de otras ramas (agentes en paralelo)", () => {
		enableMemory();
		add();
		const g = (...a: string[]) => spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...a], { cwd: repo, encoding: "utf8" });
		g("add", "-A");
		g("commit", "-qm", "base");
		const base = g("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
		g("checkout", "-q", "-b", "otra");
		g("commit", "-q", "--allow-empty", "-m", "de la otra rama\n\nDecision: 2026-01-01-solo-en-otra");
		g("checkout", "-q", base);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});
});

describe("sin índice compartido: ramas paralelas (D19)", () => {
	const git = (...args: string[]) =>
		spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: repo, encoding: "utf8" });

	test("dos add en ramas distintas desde la misma base se fusionan sin conflicto", () => {
		enableMemory();
		write("docs/decisions/README.md", "# Decisiones\n\nFormato del registro.\n");
		git("add", "-A");
		git("commit", "-qm", "base: README de decisiones");
		const base = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();

		git("checkout", "-q", "-b", "feat/a");
		addDecision(repo, "docs/decisions", { title: "Decision A", decision: "La A." });
		git("add", "-A");
		git("commit", "-qm", "record decision A");

		git("checkout", "-q", base);
		addDecision(repo, "docs/decisions", { title: "Decision B", decision: "La B." });
		git("add", "-A");
		git("commit", "-qm", "record decision B");

		const m = git("merge", "--no-edit", "feat/a");
		expect(m.status).toBe(0);
		const today = new Date().toISOString().slice(0, 10);
		expect(existsSync(at(`docs/decisions/${today}-decision-a.md`))).toBe(true);
		expect(existsSync(at(`docs/decisions/${today}-decision-b.md`))).toBe(true);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});
});

describe("CLI de lista y runs", () => {
	const capture = async (args: string[]) => {
		const lines: string[] = [];
		const orig = console.log;
		console.log = (...a: unknown[]) => lines.push(a.join(" "));
		try {
			await decisions(args);
		} finally {
			console.log = orig;
		}
		return lines.join("\n");
	};

	test("--json de la lista es estable y filtra por estado y agente", async () => {
		enableMemory();
		add({ title: "Una" });
		add({ title: "Dos" });
		const all = JSON.parse(await capture(["--json"]));
		expect(all.length).toBe(2);
		expect(Object.keys(all[0]).sort().join(",")).toBe("accepted_by,accepted_via,body,date,decided_by,id,links,rel,status,superseded_by,supersedes,title");
		expect(JSON.parse(await capture(["--json", "--status", "accepted"])).length).toBe(0);
		expect(JSON.parse(await capture(["--json", "--agent", "user"])).length).toBe(2);
	});

	test("runs lista los ficheros de <dir>/runs con su frontmatter", async () => {
		enableMemory();
		write("docs/decisions/runs/2026-01-01-worker-2-tarea.md", `---\nagent: "worker-2"\nkind: "pi"\nbranch: "feat/x"\nstatus: "sent"\ncommits: []\ndecisions: []\n---\n\n## Request\n\nhaz algo\n`);
		const out = JSON.parse(await capture(["runs", "--json"]));
		expect(out.length).toBe(1);
		expect(out[0].file).toBe("docs/decisions/runs/2026-01-01-worker-2-tarea.md");
		expect(out[0].agent).toBe("worker-2");
		expect(JSON.parse(await capture(["runs", "--json", "--agent", "claude"])).length).toBe(0);
	});

	test("sin [decisions], la lista sale con 0 y lo explica", () => {
		write(".bond/bond.toml", 'agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n');
		const r = bond(["decisions"]);
		expect(r.status).toBe(0);
		expect(r.stdout).toContain("no usa la memoria de decisiones");
	});
});

// P6 (D20): aceptar desde la conversación con --confirmed-by, varios ids y --all-proposed.
describe("accept/reject/supersede desde la conversación (D20)", () => {
	test("--confirmed-by sin terminal acepta y guarda accepted_by y accepted_via", () => {
		enableMemory();
		const { id } = add();
		const r = bond(["decisions", "accept", id, "--confirmed-by", "«acepta la 1, user»"]);
		expect(r.status).toBe(0);
		const fm = parseFm(read(`docs/decisions/${id}.md`));
		expect(fm?.scalars.status).toBe("accepted");
		expect(fm?.scalars.accepted_by).toBe("«acepta la 1, user»");
		// Fuera de Herdr la autoría de la ejecucion es "user" (D12).
		expect(fm?.scalars.accepted_via).toBe("user");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("--confirmed-by vacio o en blanco se rechaza y no cambia nada", () => {
		enableMemory();
		const { id } = add();
		const before = read(`docs/decisions/${id}.md`);
		for (const v of ["", "   "]) {
			const r = bond(["decisions", "accept", id, "--confirmed-by", v]);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain("--confirmed-by");
			expect(read(`docs/decisions/${id}.md`)).toBe(before);
		}
	});

	test("varios ids: se aceptan los validos y un id desconocido se informa sin abortar", () => {
		enableMemory();
		const a = add({ title: "Una" });
		const b = add({ title: "Dos" });
		const r = bond(["decisions", "accept", a.id, b.id, "no-existe-9999", "--confirmed-by", "«ambas, user»"]);
		expect(r.status).toBe(1); // alguno fallo
		expect(r.stderr).toContain("no-existe-9999");
		expect(parseFm(read(`docs/decisions/${a.id}.md`))?.scalars.status).toBe("accepted");
		expect(parseFm(read(`docs/decisions/${b.id}.md`))?.scalars.status).toBe("accepted");
	});

	test("un id no proposed se informa sin abortar y la salida es != 0", () => {
		enableMemory();
		const a = add({ title: "Una" });
		const b = add({ title: "Dos" });
		bond(["decisions", "accept", a.id, "--confirmed-by", "«una, user»"]);
		const r = bond(["decisions", "accept", a.id, b.id, "--confirmed-by", "«las dos, user»"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("no es");
		expect(parseFm(read(`docs/decisions/${b.id}.md`))?.scalars.status).toBe("accepted");
	});

	test("--all-proposed acepta todas las propuestas y deja las demas", () => {
		enableMemory();
		const a = add({ title: "Una" });
		const b = add({ title: "Dos" });
		const c = add({ title: "Tres" });
		bond(["decisions", "reject", c.id, "--confirmed-by", "«tres no, user»"]);
		const r = bond(["decisions", "accept", "--all-proposed", "--confirmed-by", "«todas, user»"]);
		expect(r.status).toBe(0);
		expect(parseFm(read(`docs/decisions/${a.id}.md`))?.scalars.status).toBe("accepted");
		expect(parseFm(read(`docs/decisions/${b.id}.md`))?.scalars.status).toBe("accepted");
		expect(parseFm(read(`docs/decisions/${c.id}.md`))?.scalars.status).toBe("rejected");
	});

	test("--all-proposed sin propuestas no falla y no cambia nada", () => {
		enableMemory();
		const a = add();
		bond(["decisions", "accept", a.id, "--confirmed-by", "«vale, user»"]);
		const before = read(`docs/decisions/${a.id}.md`);
		const r = bond(["decisions", "accept", "--all-proposed", "--confirmed-by", "«otras, user»"]);
		expect(r.status).toBe(0);
		expect(read(`docs/decisions/${a.id}.md`)).toBe(before);
	});

	test("reject con --confirmed-by pasa a rejected con la referencia", () => {
		enableMemory();
		const { id } = add();
		const r = bond(["decisions", "reject", id, "--confirmed-by", "«no, user»"]);
		expect(r.status).toBe(0);
		const fm = parseFm(read(`docs/decisions/${id}.md`));
		expect(fm?.scalars.status).toBe("rejected");
		expect(fm?.scalars.accepted_by).toBe("«no, user»");
		expect(fm?.scalars.accepted_via).toBe("user");
	});

	test("supersede con --confirmed-by: la vieja queda superseded y la nueva la referencia en supersedes", () => {
		enableMemory();
		const vieja = add({ title: "Vieja" });
		const nueva = add({ title: "Nueva" });
		const r = bond(["decisions", "supersede", vieja.id, "--by", nueva.id, "--confirmed-by", "«cambia a la nueva, user»"]);
		expect(r.status).toBe(0);
		const v = parseFm(read(`docs/decisions/${vieja.id}.md`));
		expect(v?.scalars.status).toBe("superseded");
		expect(v?.scalars.superseded_by).toBe(nueva.id);
		expect(v?.scalars.accepted_by).toBe("«cambia a la nueva, user»");
		expect(v?.scalars.accepted_via).toBe("user");
		// La nueva la referencia a la vieja (no a si misma) y sigue propuesta.
		const n = parseFm(read(`docs/decisions/${nueva.id}.md`));
		expect(n?.scalars.supersedes).toBe(vieja.id);
		expect(n?.scalars.status).toBe("proposed");
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
	});

	test("supersede: --by igual que una de las sustituidas se rechaza", () => {
		enableMemory();
		const a = add({ title: "Una" });
		const r = bond(["decisions", "supersede", a.id, "--by", a.id, "--confirmed-by", "«raro, user»"]);
		expect(r.status).toBe(1);
		expect(r.stderr).toContain("--by");
		expect(parseFm(read(`docs/decisions/${a.id}.md`))?.scalars.status).toBe("proposed");
	});

	test("check valida accepted_via si está y lo ignora si falta", () => {
		enableMemory();
		// Sin accepted_via (decisiones ya escritas antes de P6): valido.
		write("docs/decisions/2026-01-01-sin-via.md", `---\nid: "2026-01-01-sin-via"\ntitle: "t"\nstatus: "accepted"\ndate: "2026-01-01"\ndecided_by: "user"\naccepted_by: "sesion"\n---\n`);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
		// Con accepted_via valido: user y agent:<kind>[/<nombre>].
		write("docs/decisions/2026-01-02-via-user.md", `---\nid: "2026-01-02-via-user"\ntitle: "t"\nstatus: "accepted"\ndate: "2026-01-02"\ndecided_by: "user"\naccepted_via: "user"\n---\n`);
		write("docs/decisions/2026-01-03-via-agent.md", `---\nid: "2026-01-03-via-agent"\ntitle: "t"\nstatus: "accepted"\ndate: "2026-01-03"\ndecided_by: "user"\naccepted_via: "agent:pi/kevin"\n---\n`);
		expect(checkDecisions(repo, "docs/decisions").errors).toEqual([]);
		// Accepted_via invalido: error nombrando el fichero.
		write("docs/decisions/2026-01-04-via-malo.md", `---\nid: "2026-01-04-via-malo"\ntitle: "t"\nstatus: "accepted"\ndate: "2026-01-04"\ndecided_by: "user"\naccepted_via: "gpt-99"\n---\n`);
		const errs = checkDecisions(repo, "docs/decisions").errors;
		expect(errs.some((e) => e.includes("accepted_via") && e.includes("2026-01-04-via-malo"))).toBe(true);
	});
});

describe("slugify", () => {
	test("pasa a minúsculas, quita acentos y deja guiones", () => {
		expect(slugify("Preferir Bun — decisión difícil")).toBe("preferir-bun-decision-dificil");
		expect(slugify("  spaces & symbols!! ")).toBe("spaces-symbols");
	});
});
