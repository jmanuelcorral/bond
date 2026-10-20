import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COPY_MARK, copyPath, isCopyOf, which } from "../cli/util.mts";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bond-util-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const touch = (p: string, s = "") => {
	mkdirSync(join(p, ".."), { recursive: true });
	writeFileSync(p, s);
};

describe("which", () => {
	test("en Windows prueba las extensiones de PATHEXT", () => {
		const a = join(dir, "a");
		const b = join(dir, "b");
		touch(join(a, "claude.cmd"));
		touch(join(b, "codex.exe"));
		const env = { PATH: `${a};${b}`, PATHEXT: ".COM;.EXE;.BAT;.CMD" };
		expect(which("claude", env, "win32")).toBe(join(a, "claude.cmd"));
		expect(which("codex", env, "win32")).toBe(join(b, "codex.exe"));
		expect(which("pi", env, "win32")).toBeUndefined();
	});

	test("en Windows sin PATHEXT usa las extensiones habituales", () => {
		touch(join(dir, "gemini.cmd"));
		expect(which("gemini", { Path: dir }, "win32")).toBe(join(dir, "gemini.cmd"));
	});

	test("fuera de Windows, el nombre tal cual y nunca una carpeta", () => {
		touch(join(dir, "pi"));
		mkdirSync(join(dir, "claude"));
		touch(join(dir, "codex.exe"));
		const env = { PATH: `/no/existe:${dir}` };
		expect(which("pi", env, "linux")).toBe(join(dir, "pi"));
		expect(which("claude", env, "linux")).toBeUndefined();
		expect(which("codex", env, "linux")).toBeUndefined();
	});
});

describe("copyPath", () => {
	test("copia, reconoce su copia y la sustituye al cambiar el origen", () => {
		const src = join(dir, "src");
		const dest = join(dir, "dest");
		touch(join(src, "SKILL.md"), "v1");
		touch(join(src, "scripts", "x"), "x");
		copyPath(src, dest);
		expect(existsSync(join(dest, COPY_MARK))).toBe(true);
		expect(isCopyOf(src, dest)).toBe(true);

		writeFileSync(join(src, "SKILL.md"), "v2");
		expect(isCopyOf(src, dest)).toBe(false);
		copyPath(src, dest);
		expect(readFileSync(join(dest, "SKILL.md"), "utf8")).toBe("v2");
		expect(readdirSync(dir).filter((f) => f.includes(".bak."))).toEqual([]);
	});

	test("una carpeta que no es de bond se guarda como .bak", () => {
		const src = join(dir, "src");
		const dest = join(dir, "dest");
		touch(join(src, "SKILL.md"), "bond");
		touch(join(dest, "SKILL.md"), "mía");
		copyPath(src, dest);
		expect(readFileSync(join(dest, "SKILL.md"), "utf8")).toBe("bond");
		const bak = readdirSync(dir).find((f) => f.startsWith("dest.bak."));
		expect(bak && readFileSync(join(dir, bak, "SKILL.md"), "utf8")).toBe("mía");
	});
});
