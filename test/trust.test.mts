import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inheritClaudeTrust, inheritPiTrust, inheritTrust, withLock } from "../cli/trust.mts";

let dir: string;
let files: { pi: string; claude: string };
const main = join("/", "src", "repo");
const wt = join("/", "home", "u", ".herdr", "worktrees", "repo", "feat-a");
const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bond-trust-"));
	files = { pi: join(dir, "trust.json"), claude: join(dir, ".claude.json") };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("pi", () => {
	test("checkout principal de confianza: añade el worktree y conserva el resto", () => {
		writeFileSync(files.pi, `${JSON.stringify({ [main]: true, "/otro": false, "/nulo": null }, null, 2)}\n`);
		expect(inheritPiTrust(main, wt, files.pi)).toBe("heredada");
		expect(read(files.pi)).toEqual({ [main]: true, "/otro": false, "/nulo": null, [wt]: true });
		expect(readFileSync(files.pi, "utf8").endsWith("\n")).toBe(true);
		expect(existsSync(`${files.pi}.lock`)).toBe(false);
	});

	test("vale la entrada más cercana subiendo carpetas (Trust parent folder)", () => {
		writeFileSync(files.pi, JSON.stringify({ [join("/", "src")]: true }));
		expect(inheritPiTrust(main, wt, files.pi)).toBe("heredada");
	});

	test("sin confianza, o con una entrada más cercana que no confía: no toca nada", () => {
		const before = JSON.stringify({ [join("/", "src")]: true, [main]: false });
		writeFileSync(files.pi, before);
		expect(inheritPiTrust(main, wt, files.pi)).toBe("sin confianza");
		expect(readFileSync(files.pi, "utf8")).toBe(before);
		expect(inheritPiTrust(main, wt, join(dir, "no-existe.json"))).toBe("sin confianza");
	});

	test("respeta lo que ya hay para el worktree o sus carpetas", () => {
		writeFileSync(files.pi, JSON.stringify({ [main]: true, [wt]: false }));
		expect(inheritPiTrust(main, wt, files.pi)).toBe("sin confianza");
		writeFileSync(files.pi, JSON.stringify({ [main]: true, [join("/", "home", "u", ".herdr")]: true }));
		expect(inheritPiTrust(main, wt, files.pi)).toBe("ya la tenía");
	});

	test("espera al cerrojo de pi y quita uno abandonado", () => {
		writeFileSync(files.pi, JSON.stringify({ [main]: true }));
		mkdirSync(`${files.pi}.lock`);
		expect(() => withLock(files.pi, () => 1, 100)).toThrow(/cogido/);
		const old = (Date.now() - 60_000) / 1000;
		utimesSync(`${files.pi}.lock`, old, old);
		expect(inheritPiTrust(main, wt, files.pi)).toBe("heredada");
		expect(existsSync(`${files.pi}.lock`)).toBe(false);
	});
});

describe("Claude Code", () => {
	const config = (projects: Record<string, unknown>) => ({ numStartups: 3, oauthAccount: { x: 1 }, projects });

	test("checkout principal aceptado: añade el worktree y conserva el resto", () => {
		writeFileSync(files.claude, JSON.stringify(config({ [main]: { hasTrustDialogAccepted: true, history: ["a"] } }), null, 2), { mode: 0o600 });
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("heredada");
		const after = read(files.claude);
		expect(after.numStartups).toBe(3);
		expect(after.oauthAccount).toEqual({ x: 1 });
		expect(after.projects[main]).toEqual({ hasTrustDialogAccepted: true, history: ["a"] });
		expect(after.projects[wt.replace(/\\/g, "/")]).toMatchObject({ hasTrustDialogAccepted: true, allowedTools: [] });
		if (process.platform !== "win32") expect(statSync(files.claude).mode & 0o777).toBe(0o600);
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("ya la tenía");
	});

	test("vale una carpeta superior aceptada", () => {
		writeFileSync(files.claude, JSON.stringify(config({ [join("/", "src")]: { hasTrustDialogAccepted: true } })));
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("heredada");
	});

	test("una entrada previa del worktree sin aceptar se marca sin perder sus datos", () => {
		const key = wt.replace(/\\/g, "/");
		writeFileSync(files.claude, JSON.stringify(config({ [main]: { hasTrustDialogAccepted: true }, [key]: { hasTrustDialogAccepted: false, lastCost: 2 } })));
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("heredada");
		expect(read(files.claude).projects[key]).toEqual({ hasTrustDialogAccepted: true, lastCost: 2 });
	});

	test("sin aceptar el checkout principal: no toca nada", () => {
		const before = JSON.stringify(config({ [main]: { hasTrustDialogAccepted: false } }));
		writeFileSync(files.claude, before);
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("sin confianza");
		expect(readFileSync(files.claude, "utf8")).toBe(before);
		expect(inheritClaudeTrust(main, wt, join(dir, "no-existe.json"))).toBe("sin confianza");
	});
});

test("otros agentes: no aplica", () => {
	expect(inheritTrust("codex", main, wt, files)).toBe("no aplica");
	expect(existsSync(files.pi) || existsSync(files.claude)).toBe(false);
});
