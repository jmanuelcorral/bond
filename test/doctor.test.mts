// bond doctor: la fila de actualizaciones (método, última comprobación, pendiente, omitida y aviso).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateCheck } from "../cli/doctor.mts";
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
