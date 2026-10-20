// bond update contra un servidor de releases falso (como GitHub: /latest redirige al tag).

import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assetName, compareVersions, downloadVerified, installMethod, latestTag, replaceBinary } from "../cli/update.mts";

const files: Record<string, string> = {};
const server = Bun.serve({
	port: 0,
	fetch(req) {
		const path = new URL(req.url).pathname;
		if (path === "/releases/latest") return new Response(null, { status: 302, headers: { location: "https://example.com/o/r/releases/tag/v9.1.0" } });
		const body = files[path];
		return body === undefined ? new Response("not found", { status: 404 }) : new Response(body);
	},
});
const base = `http://localhost:${server.port}/releases`;
afterAll(() => server.stop(true));

function publish(tag: string, assets: Record<string, string>, sums = assets): void {
	const lines = Object.entries(sums).map(([n, c]) => `${createHash("sha256").update(c).digest("hex")}  ${n}`);
	files[`/releases/download/${tag}/SHA256SUMS`] = `${lines.join("\n")}\n`;
	for (const [n, c] of Object.entries(assets)) files[`/releases/download/${tag}/${n}`] = c;
}

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bond-update-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("versiones y plataformas", () => {
	test("compareVersions compara números, no texto", () => {
		expect(compareVersions("v1.0.10", "1.0.9")).toBeGreaterThan(0);
		expect(compareVersions("1.1.0", "v1.1.0")).toBe(0);
		expect(compareVersions("1.0.2", "2.0.0")).toBeLessThan(0);
	});

	test("assetName da el binario publicado para cada plataforma", () => {
		expect(assetName("linux", "x64")).toBe("bond-linux-x64");
		expect(assetName("darwin", "arm64")).toBe("bond-darwin-arm64");
		expect(assetName("win32", "x64")).toBe("bond-windows-x64.exe");
		expect(assetName("win32", "arm64")).toBe("bond-windows-x64.exe");
		expect(() => assetName("freebsd", "x64")).toThrow();
	});
});

describe("releases", () => {
	test("latestTag sigue la redirección de /latest", async () => {
		expect(await latestTag(base)).toBe("v9.1.0");
	});

	test("downloadVerified devuelve el binario si la suma coincide", async () => {
		publish("v9.1.0", { "bond-linux-x64": "binario" });
		expect((await downloadVerified("v9.1.0", "bond-linux-x64", base)).toString()).toBe("binario");
	});

	test("downloadVerified rechaza un binario alterado o que no está en las sumas", async () => {
		publish("v9.2.0", { "bond-linux-x64": "alterado" }, { "bond-linux-x64": "original" });
		expect(downloadVerified("v9.2.0", "bond-linux-x64", base)).rejects.toThrow("SHA-256");
		publish("v9.3.0", { "bond-linux-x64": "x" });
		expect(downloadVerified("v9.3.0", "bond-darwin-arm64", base)).rejects.toThrow("no aparece");
	});
});

describe("instalación", () => {
	test("installMethod distingue código, npm y binario", () => {
		expect(installMethod(join(dir, "bond"), true)).toBe("source");
		expect(installMethod(join(dir, "node"), false)).toBe("npm");
		expect(installMethod(join(dir, "node.exe"), false)).toBe("npm");
		expect(installMethod(join(dir, "bond"), false)).toBe("binary");
	});

	// Homebrew enlaza bin/bond a Cellar/bond/<versión>/bin/bond (en Windows no hay Homebrew).
	test.skipIf(process.platform === "win32")("installMethod reconoce Homebrew por el enlace a Cellar", () => {
		const cellar = join(dir, "Cellar", "bond", "1.0.0", "bin");
		mkdirSync(cellar, { recursive: true });
		writeFileSync(join(cellar, "bond"), "");
		symlinkSync(join(cellar, "bond"), join(dir, "bond"));
		expect(installMethod(join(dir, "bond"), false)).toBe("brew");
	});

	test("replaceBinary sustituye el ejecutable", () => {
		writeFileSync(join(dir, "bond"), "viejo");
		writeFileSync(join(dir, ".bond-new"), "nuevo");
		replaceBinary(join(dir, ".bond-new"), join(dir, "bond"), "linux");
		expect(readFileSync(join(dir, "bond"), "utf8")).toBe("nuevo");
		expect(readdirSync(dir)).toEqual(["bond"]);
	});

	test("en Windows aparta el ejecutable en marcha como .old", () => {
		writeFileSync(join(dir, "bond.exe"), "viejo");
		writeFileSync(join(dir, "bond.exe.old"), "más viejo");
		writeFileSync(join(dir, ".bond-new.exe"), "nuevo");
		replaceBinary(join(dir, ".bond-new.exe"), join(dir, "bond.exe"), "win32");
		expect(readFileSync(join(dir, "bond.exe"), "utf8")).toBe("nuevo");
		expect(readFileSync(join(dir, "bond.exe.old"), "utf8")).toBe("viejo");
	});
});
