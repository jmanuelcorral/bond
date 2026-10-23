// bond update --skip / --skip-reset: lo que guardan en state.json y cómo lo respeta el aviso de
// arranque (offerUpdate), contra un servidor de releases falso. Cada orden corre en su proceso
// con un BOND_HOME temporal (BOND_HOME se fija al cargar cli/runtime.mts).

import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let latest = "v9.1.0";
let hits = 0;
const server = Bun.serve({
	port: 0,
	fetch(req) {
		if (new URL(req.url).pathname !== "/releases/latest") return new Response("not found", { status: 404 });
		hits++;
		return new Response(null, { status: 302, headers: { location: `https://example.com/o/r/releases/tag/${latest}` } });
	},
});
const base = `http://localhost:${server.port}/releases`;
afterAll(() => server.stop(true));

const MAIN = join(import.meta.dir, "..", "cli", "main.mts");
const DRIVER = join(import.meta.dir, "offer-driver.mts");
const T0 = Date.parse("2026-10-22T08:00:00Z");
const DAY = 24 * 3_600_000;

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "bond-skip-"));
	latest = "v9.1.0";
	hits = 0;
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const env = () => ({ ...process.env, BOND_HOME: home, XDG_CONFIG_HOME: join(home, "xdg"), BOND_RELEASES_URL: base, BOND_NO_UPDATE: "", NO_COLOR: "1" });

async function bond(...args: string[]) {
	const p = Bun.spawn([process.execPath, MAIN, ...args], { env: env(), stdout: "pipe", stderr: "pipe" });
	const [out, err] = [await new Response(p.stdout).text(), await new Response(p.stderr).text()];
	return { code: await p.exited, out, err };
}

async function offer(now: number) {
	const p = Bun.spawn([process.execPath, DRIVER, JSON.stringify({ base, now, interactive: true, method: "binary" })], { env: env(), stdout: "pipe", stderr: "pipe" });
	const out = await new Response(p.stdout).text();
	await p.exited;
	return /RESULT=(\w+)/.exec(out)?.[1];
}

const state = () => JSON.parse(readFileSync(join(home, "state.json"), "utf8"));

describe("bond update --skip", () => {
	test("guarda la versión (con o sin v) sin tocar la red ni el resto del estado", async () => {
		writeFileSync(join(home, "state.json"), JSON.stringify({ probes: { gw: { apis: ["chat"], served: [], at: "x" } }, managed: {}, backedUp: [], update: { checkedAt: "2026-10-21T08:00:00.000Z" } }));
		const r = await bond("update", "--skip", "9.1.0");
		expect(r.code).toBe(0);
		expect(r.out).toContain("no avisaré de la 9.1.0");
		expect(state().update).toEqual({ checkedAt: "2026-10-21T08:00:00.000Z", skipped: "v9.1.0" });
		expect(state().probes.gw.apis).toEqual(["chat"]);
		expect(hits).toBe(0);
	});

	test("el aviso deja de nombrar esa versión y vuelve con la siguiente", async () => {
		expect((await bond("update", "--skip", "v9.1.0")).code).toBe(0);
		expect(await offer(T0)).toBe("skipped");
		latest = "v9.2.0";
		expect(await offer(T0 + DAY)).toBe("later");
		expect(state().update.skipped).toBe("v9.1.0");
	});

	test("--skip-reset la quita y el aviso vuelve a nombrarla", async () => {
		await bond("update", "--skip", "v9.1.0");
		const r = await bond("update", "--skip-reset");
		expect(r.code).toBe(0);
		expect(r.out).toContain("vuelvo a avisar de la 9.1.0");
		expect(state().update.skipped).toBeUndefined();
		expect(await offer(T0)).toBe("later");
	});

	test("--skip-reset sin omisión no escribe nada", async () => {
		const r = await bond("update", "--skip-reset");
		expect(r.code).toBe(0);
		expect(r.out).toContain("no había ninguna versión omitida");
		expect(existsSync(join(home, "state.json"))).toBe(false);
	});

	test("--dry-run dice qué haría sin guardar", async () => {
		const r = await bond("update", "--skip", "v9.1.0", "--dry-run");
		expect(r.code).toBe(0);
		expect(r.out).toContain("[dry-run] omitiría la 9.1.0");
		expect(existsSync(join(home, "state.json"))).toBe(false);
	});

	test("rechaza una versión mal formada, sin valor o mezclada con otras opciones", async () => {
		for (const args of [["--skip", "latest"], ["--skip"], ["--skip", "v9.1.0", "--skip-reset"], ["--skip", "v9.1.0", "--check"], ["--skip-reset", "--version", "v1.0.0"]]) {
			const r = await bond("update", ...args);
			expect(r.code).not.toBe(0);
			expect(r.err).toContain("error");
		}
		expect(existsSync(join(home, "state.json"))).toBe(false);
		expect(hits).toBe(0);
	});

	test("la ayuda enumera --skip y --skip-reset", async () => {
		const r = await bond("update", "--help");
		expect(r.out).toContain("--skip <vX.Y.Z>");
		expect(r.out).toContain("--skip-reset");
	});
});
