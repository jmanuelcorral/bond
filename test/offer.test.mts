// offerUpdate(): el aviso de versión nueva al arrancar, contra un servidor de releases falso.
// Cada caso corre en su proceso (test/offer-driver.mts) con un BOND_HOME temporal.

import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assetName } from "../cli/update.mts";

let latest = "v9.1.0";
let hits = 0;
const files: Record<string, string> = {};
const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const path = new URL(req.url).pathname;
		if (path === "/hang/latest") await Bun.sleep(10_000);
		if (path === "/releases/latest") {
			hits++;
			return new Response(null, { status: 302, headers: { location: `https://example.com/o/r/releases/tag/${latest}` } });
		}
		const body = files[path];
		return body === undefined ? new Response("not found", { status: 404 }) : new Response(body);
	},
});
const base = `http://localhost:${server.port}/releases`;
afterAll(() => server.stop(true));

/** Publica un "binario" (un script de shell) que responde `--version` con `prints`. */
function publish(tag: string, prints: string): void {
	const bin = `#!/bin/sh\n[ "$1" = --version ] && echo ${prints}\nexit 0\n`;
	const asset = assetName();
	files[`/releases/download/${tag}/SHA256SUMS`] = `${createHash("sha256").update(bin).digest("hex")}  ${asset}\n`;
	files[`/releases/download/${tag}/${asset}`] = bin;
}

let home: string;
let exe: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "bond-offer-"));
	mkdirSync(join(home, "bin"));
	exe = join(home, "bin", "bond");
	writeFileSync(exe, "viejo", { mode: 0o755 });
	latest = "v9.1.0";
	hits = 0;
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-22T08:00:00Z");

async function offer(opts: Record<string, unknown> = {}, env: Record<string, string> = {}) {
	const p = Bun.spawn([process.execPath, join(import.meta.dir, "offer-driver.mts"), JSON.stringify({ base, now: T0, interactive: true, method: "binary", exe, ...opts })], {
		env: { ...process.env, BOND_NO_UPDATE: "", BOND_HOME: home, NO_COLOR: "1", ...env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err] = [await new Response(p.stdout).text(), await new Response(p.stderr).text()];
	await p.exited;
	return { result: /RESULT=(\w+)/.exec(out)?.[1], out, err };
}

const state = () => JSON.parse(readFileSync(join(home, "state.json"), "utf8")).update;
const config = () => readFileSync(join(home, "config.toml"), "utf8");

describe("cuándo mira", () => {
	test("el primer arranque con release nueva pregunta y guarda la consulta", async () => {
		const r = await offer();
		expect(r.result).toBe("later");
		expect(r.out).toContain("1) Actualizar ahora");
		expect(r.out).toContain("2) Omitir la 9.1.0");
		expect(r.out).toContain("3) No volver a preguntar");
		expect(state()).toEqual({ checkedAt: new Date(T0).toISOString(), latest: "v9.1.0" });
		expect(hits).toBe(1);
	});

	test("dentro de las 24 h no toca la red; pasadas, vuelve a mirar", async () => {
		await offer();
		expect((await offer({ now: T0 + 23 * HOUR })).result).toBe("throttled");
		expect(hits).toBe(1);
		expect((await offer({ now: T0 + 25 * HOUR })).result).toBe("later");
		expect(hits).toBe(2);
	});

	test("BOND_NO_UPDATE=1 no mira", async () => {
		expect((await offer({}, { BOND_NO_UPDATE: "1" })).result).toBe("off");
		expect(hits).toBe(0);
		expect(existsSync(join(home, "state.json"))).toBe(false);
	});

	test("sin red, el arranque sigue en silencio", async () => {
		const r = await offer({ base: "http://127.0.0.1:9/releases" });
		expect(r.result).toBe("offline");
		expect(r.out + r.err).not.toContain("aviso");
		expect(state().checkedAt).toBe(new Date(T0).toISOString());
	});

	test("si las releases no responden, se deja a los ~2 s", async () => {
		const start = Date.now();
		expect((await offer({ base: `http://localhost:${server.port}/hang` })).result).toBe("offline");
		expect(Date.now() - start).toBeLessThan(5000);
	});

	test("sin versión nueva no dice nada", async () => {
		latest = "v0.0.1";
		const r = await offer();
		expect(r.result).toBe("current");
		expect(r.out).not.toContain("Actualizar");
	});

	test("sin terminal no pregunta: solo avisa", async () => {
		const r = await offer({ interactive: false });
		expect(r.result).toBe("informed");
		expect(r.err).toContain("9.1.0 disponible");
		expect(r.out).not.toContain("1) Actualizar ahora");
	});
});

describe("respuestas", () => {
	test("«2» omite esa versión; la siguiente sí se ofrece", async () => {
		expect((await offer({ answer: "2" })).result).toBe("skip");
		expect(state().skipped).toBe("v9.1.0");
		expect((await offer({ now: T0 + 25 * HOUR })).result).toBe("skipped");
		latest = "v9.2.0";
		expect((await offer({ now: T0 + 50 * HOUR })).result).toBe("later");
	});

	test("«3» deja auto = false y no vuelve a preguntar", async () => {
		expect((await offer({ answer: "3" })).result).toBe("never");
		expect(config()).toContain("[update]\nauto = false");
		expect((await offer({ now: T0 + 25 * HOUR })).result).toBe("off");
		expect(hits).toBe(1);
	});

	test("«3» respeta el resto de config.toml, comentarios incluidos", async () => {
		const before = '# mi comentario\nagents = ["pi"]\n\n[update]\nauto = true # otro\n\n[providers.halo]\nbase_url = "http://h/v1"\n';
		writeFileSync(join(home, "config.toml"), before);
		await offer({ answer: "3" });
		expect(config()).toBe(before.replace("auto = true # otro", "auto = false"));
	});

	test("«1» desde el código solo dice el comando", async () => {
		const r = await offer({ answer: "1", method: "source" });
		expect(r.result).toBe("manual");
		expect(r.out).toContain("git -C");
		expect(readFileSync(exe, "utf8")).toBe("viejo");
	});

	// El binario falso es un script de shell.
	test.skipIf(process.platform === "win32")("«1» con el binario instala la versión nueva", async () => {
		publish("v9.1.0", "9.1.0");
		const r = await offer({ answer: "1" });
		expect(r.result).toBe("updated");
		expect(spawnSync(exe, ["--version"], { encoding: "utf8" }).stdout.trim()).toBe("9.1.0");
	});

	test.skipIf(process.platform === "win32")("si el binario nuevo no arranca, se queda el actual y avisa", async () => {
		publish("v9.1.0", "otra-cosa");
		const r = await offer({ answer: "1" });
		expect(r.result).toBe("failed");
		expect(r.err).toContain("no arranca bien");
		expect(r.err).toContain("Sigues con bond");
		expect(readFileSync(exe, "utf8")).toBe("viejo");
	});
});
