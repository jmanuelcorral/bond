// bond doctor: la fila de actualizaciones (método, última comprobación, pendiente, omitida y
// aviso) y la de catálogos del repo (commit fijado, caché y ref).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalogCheck, updateCheck } from "../cli/doctor.mts";
import { addDecision, decisionsDoctor } from "../cli/decisions.mts";
import { installedRuntime } from "../cli/runtime.mts";

describe("runtime instalado (Bond Extensions desde el repo)", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "bond-rt-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	test("acepta runtime/<versión> con .complete", () => {
		mkdirSync(join(dir, "1.5.0"), { recursive: true });
		writeFileSync(join(dir, "1.5.0", ".complete"), "1.5.0\n");
		expect(installedRuntime(join(dir, "1.5.0"), dir)).toBe("1.5.0");
	});

	test("rechaza lo que no es un runtime instalado", () => {
		mkdirSync(join(dir, "1.5.0"), { recursive: true });
		expect(installedRuntime(join(dir, "1.5.0"), dir)).toBeUndefined(); // sin .complete
		expect(installedRuntime(dir, dir)).toBeUndefined(); // el propio runtime
		expect(installedRuntime(join(dir, "..", "otro"), dir)).toBeUndefined(); // fuera del runtime
		mkdirSync(join(dir, "1.5.0", "sub"), { recursive: true });
		writeFileSync(join(dir, "1.5.0", "sub", ".complete"), "x\n");
		expect(installedRuntime(join(dir, "1.5.0", "sub"), dir)).toBeUndefined(); // anidado
	});
});

describe("fila de actualizaciones", () => {
	test("sin ninguna comprobación informa y no falla", () => {
		const r = updateCheck({ method: "binary", auto: true, version: "1.3.0" });
		expect(r.level).toBe("ok");
		expect(r.name).toBe("actualizaciones");
		expect(r.detail).toBe("binario · última comprobación: nunca · pendiente: ninguna · omitida: ninguna · aviso al arrancar: sí");
	});

	test("con versión pendiente avisa y da el comando", () => {
		const r = updateCheck({ method: "brew", auto: true, version: "1.3.0", state: { checkedAt: "2026-10-22T08:00:00.000Z", latest: "v1.4.0" } });
		expect(r.level).toBe("warn");
		expect(r.fix).toBe("bond update");
		expect(r.detail).toContain("Homebrew");
		expect(r.detail).toContain("última comprobación: 2026-10-22 08:00 UTC");
		expect(r.detail).toContain("pendiente: 1.4.0");
	});

	test("la pendiente omitida se enseña pero no avisa", () => {
		const r = updateCheck({ method: "binary", auto: true, version: "1.3.0", state: { checkedAt: "2026-10-22T08:00:00.000Z", latest: "v1.4.0", skipped: "v1.4.0" } });
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("pendiente: 1.4.0");
		expect(r.detail).toContain("omitida: 1.4.0");
	});

	test("una release igual o anterior no queda pendiente", () => {
		expect(updateCheck({ method: "binary", auto: true, version: "1.3.0", state: { latest: "v1.3.0" } }).detail).toContain("pendiente: ninguna");
		expect(updateCheck({ method: "binary", auto: true, version: "1.3.0", state: { latest: "v1.2.0" } }).detail).toContain("pendiente: ninguna");
	});

	test("enseña auto = false, BOND_NO_UPDATE y el método", () => {
		expect(updateCheck({ method: "npm", auto: false }).detail).toContain("npm · ");
		expect(updateCheck({ method: "npm", auto: false }).detail).toContain("aviso al arrancar: no ([update] auto = false)");
		expect(updateCheck({ method: "source", auto: true, disabled: true }).detail).toContain("aviso al arrancar: desactivado (BOND_NO_UPDATE=1)");
		expect(updateCheck({ method: "source", auto: true }).detail).toStartWith("desde el código · ");
	});

	test("una fecha ilegible cuenta como nunca", () => {
		expect(updateCheck({ method: "binary", auto: true, state: { checkedAt: "ayer" } }).detail).toContain("última comprobación: nunca");
	});
});

describe("fila de catálogos del repo", () => {
	const sha = "a".repeat(40);
	const git = (o: Partial<Parameters<typeof catalogCheck>[0]> = {}) => ({
		name: "equipo",
		kind: "git" as const,
		where: "https://github.com/acme/skills-equipo",
		ref: "v1",
		sha,
		cached: true,
		remoteSha: sha,
		verified: true,
		...o,
	});

	test("en caché y al día: informativa", () => {
		const r = catalogCheck(git());
		expect(r.level).toBe("ok");
		expect(r.name).toBe("catálogo equipo");
		expect(r.detail).toContain("aaaaaaa en caché");
		expect(r.detail).toContain("al día (v1)");
	});

	test("sin descargar: informa, no falla (sync la baja)", () => {
		const r = catalogCheck(git({ cached: false }));
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("sin descargar (bond sync la baja)");
	});

	test("la ref tiene un commit más nuevo: aviso con el arreglo", () => {
		const r = catalogCheck(git({ remoteSha: "b".repeat(40) }));
		expect(r.level).toBe("warn");
		expect(r.fix).toBe("bond catalog update equipo");
		expect(r.detail).toContain("hay un commit más nuevo en v1: bbbbbbb");
	});

	test("sin verificar (--quick o sin red) no falla", () => {
		const r = catalogCheck(git({ verified: false, remoteSha: undefined }));
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("sin verificar");
		expect(r.detail).not.toContain("al día");
	});

	test("local: su carpeta declarada", () => {
		const r = catalogCheck({ name: "equipo", kind: "local", where: "../skills-equipo", verified: true });
		expect(r.level).toBe("ok");
		expect(r.detail).toBe("carpeta ../skills-equipo");
	});

	test("un error en un catálogo por git propone bond catalog update", () => {
		const r = catalogCheck({ name: "equipo", kind: "git", where: "u", verified: true, error: "no está fijado en .bond/lock.json" });
		expect(r.level).toBe("fail");
		expect(r.detail).toContain("no está fijado en .bond/lock.json");
		expect(r.fix).toBe("bond catalog update equipo");
	});

	test("un error en un local no propone update", () => {
		const r = catalogCheck({ name: "equipo", kind: "local", where: "../x", verified: true, error: "no existe la carpeta ../x" });
		expect(r.level).toBe("fail");
		expect(r.fix).toBeUndefined();
	});
});

describe("bond doctor", () => {
	let home: string;
	beforeEach(() => {
		home = mkdtempSync(join(tmpdir(), "bond-doctor-"));
	});
	afterEach(() => rmSync(home, { recursive: true, force: true }));

	async function doctorFull() {
		// En su proceso: BOND_HOME se fija al cargar cli/runtime.mts.
		const p = Bun.spawn([process.execPath, join(import.meta.dir, "..", "cli", "main.mts"), "doctor", "--quick"], {
			cwd: home,
			env: { ...process.env, BOND_HOME: home, XDG_CONFIG_HOME: join(home, "xdg"), BOND_NO_UPDATE: "", NO_COLOR: "1" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const out = await new Response(p.stdout).text();
		await p.exited;
		return out;
	}
	const doctor = async () => (await doctorFull()).split("\n").find((l) => l.includes("actualizaciones")) ?? "";

	test("refleja state.json y config.toml", async () => {
		mkdirSync(join(home, "xdg"));
		writeFileSync(join(home, "state.json"), JSON.stringify({ update: { checkedAt: "2026-10-22T08:00:00.000Z", latest: "v99.0.0", skipped: "v99.0.0" } }));
		writeFileSync(join(home, "config.toml"), "agents = []\n\n[update]\nauto = false\n");
		const row = await doctor();
		expect(row).toContain("✓ actualizaciones");
		expect(row).toContain("desde el código");
		expect(row).toContain("última comprobación: 2026-10-22 08:00 UTC");
		expect(row).toContain("pendiente: 99.0.0");
		expect(row).toContain("omitida: 99.0.0");
		expect(row).toContain("aviso al arrancar: no ([update] auto = false)");
	}, 30_000);

	test("sin estado ni config la fila no falla", async () => {
		const row = await doctor();
		expect(row).toContain("✓ actualizaciones");
		expect(row).toContain("última comprobación: nunca");
		expect(row).toContain("aviso al arrancar: sí");
	}, 30_000);

	test("desde el repo, ~/.bond/pi apuntando a un runtime válido avisa en vez de fallar", async () => {
		if (!Bun.which("pi")) return; // la fila solo se comprueba con pi instalado
		mkdirSync(join(home, "runtime", "9.9.0"), { recursive: true });
		writeFileSync(join(home, "runtime", "9.9.0", ".complete"), "9.9.0\n");
		symlinkSync(join(home, "runtime", "9.9.0"), join(home, "pi"));
		const row = ((await doctorFull()).split("\n").find((l) => l.includes("Bond Extensions")) ?? "").trim();
		expect(row).toStartWith("! Bond Extensions");
		expect(row).toContain("runtime 9.9.0");
		expect(row).not.toContain("✗");
	}, 30_000);
});

// La fila de la memoria de decisiones en bond doctor (cli/decisions.mts: decisionsDoctor).
describe("fila de decisiones en doctor", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "bond-doc-dec-"));
		delete process.env.HERDR_ENV;
		delete process.env.HERDR_PANE_ID;
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	const toml = (s: string) => {
		mkdirSync(join(dir, ".bond"), { recursive: true });
		writeFileSync(join(dir, ".bond", "bond.toml"), s);
	};

	test("sin [decisions] no muestra fila", () => {
		toml('agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n');
		expect(decisionsDoctor(dir)).toBeUndefined();
	});

	test("con [decisions] pero sin el directorio, avisa de que falta (bond sync)", () => {
		toml('agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[decisions]\ndir = "docs/decisions"\n');
		const r = decisionsDoctor(dir);
		expect(r?.level).toBe("warn");
		expect(r?.detail).toContain("no existe");
		expect(r?.fix).toBe("bond sync");
	});

	test("con el directorio creado y sin decisiones, ok con cero", () => {
		toml('agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[decisions]\ndir = "docs/decisions"\n');
		mkdirSync(join(dir, "docs/decisions"), { recursive: true });
		writeFileSync(join(dir, "docs/decisions/README.md"), "# Decisiones\n\n## Índice\n\n| ID | Estado | Quién | Fecha | Título |\n|---|---|---|---|---|\n");
		const r = decisionsDoctor(dir);
		expect(r?.level).toBe("ok");
		expect(r?.detail).toContain("0 decisiones");
	});

	test("propuestas pendientes avisan", () => {
		toml('agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[decisions]\ndir = "docs/decisions"\n');
		addDecision(dir, "docs/decisions", { title: "Algo", decision: "Se propone algo" });
		const r = decisionsDoctor(dir);
		expect(r?.level).toBe("warn");
		expect(r?.detail).toContain("1 propuesta(s)");
		expect(r?.fix).toContain("bond decisions accept");
	});

	test("errores de la memoria hacen la fila fail", () => {
		toml('agents = ["pi"]\nmcp = []\nskills = []\ncommands = []\n\n[decisions]\ndir = "docs/decisions"\n');
		mkdirSync(join(dir, "docs/decisions"), { recursive: true });
		writeFileSync(join(dir, "docs/decisions/2026-01-01-rota.md"), "# sin frontmatter\n");
		const r = decisionsDoctor(dir);
		expect(r?.level).toBe("fail");
		expect(r?.fix).toBe("bond decisions check");
	});
});
