import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inheritAgyTrust, inheritClaudeTrust, inheritPiTrust, inheritTrust, trusts, withLock } from "../cli/trust.mts";

let dir: string;
let files: { pi: string; claude: string; agy: string };
const main = join("/", "src", "repo");
const wt = join("/", "home", "u", ".herdr", "worktrees", "repo", "feat-a");
const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bond-trust-"));
	files = { pi: join(dir, "trust.json"), claude: join(dir, ".claude.json"), agy: join(dir, "settings.json") };
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
		// Claude Code guarda las rutas con / también en Windows (C:/...).
		const mainKey = main.replace(/\\/g, "/");
		writeFileSync(files.claude, JSON.stringify(config({ [mainKey]: { hasTrustDialogAccepted: true, history: ["a"] } }), null, 2), { mode: 0o600 });
		expect(inheritClaudeTrust(main, wt, files.claude)).toBe("heredada");
		const after = read(files.claude);
		expect(after.numStartups).toBe(3);
		expect(after.oauthAccount).toEqual({ x: 1 });
		expect(after.projects[mainKey]).toEqual({ hasTrustDialogAccepted: true, history: ["a"] });
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

describe("agy", () => {
	const settings = (trustedWorkspaces: unknown) => ({ colorScheme: "tokyo night", model: "Gemini", trustedWorkspaces });
	const key = (p: string) => p.replace(/\\/g, "/");

	test("checkout principal en trustedWorkspaces: añade el worktree y conserva el resto", () => {
		writeFileSync(files.agy, `${JSON.stringify(settings([key(main), "/otro"]), null, 2)}\n`, { mode: 0o600 });
		expect(inheritAgyTrust(main, wt, files.agy)).toBe("heredada");
		expect(read(files.agy)).toEqual(settings([key(main), "/otro", key(wt)]));
		expect(readFileSync(files.agy, "utf8").endsWith("\n")).toBe(true);
		if (process.platform !== "win32") expect(statSync(files.agy).mode & 0o777).toBe(0o600);
		expect(inheritAgyTrust(main, wt, files.agy)).toBe("ya la tenía");
		expect(read(files.agy).trustedWorkspaces).toHaveLength(3);
	});

	test("vale una carpeta superior de confianza; el worktree se añade con su ruta exacta", () => {
		writeFileSync(files.agy, JSON.stringify(settings([key(join("/", "src"))])));
		expect(inheritAgyTrust(main, wt, files.agy)).toBe("heredada");
		expect(read(files.agy).trustedWorkspaces).toContain(key(wt));
	});

	test("sin el checkout principal, sin lista o sin fichero: no toca nada", () => {
		for (const before of [JSON.stringify(settings(["/otro"])), JSON.stringify({ model: "Gemini" }), JSON.stringify(settings("no es lista"))]) {
			writeFileSync(files.agy, before);
			expect(inheritAgyTrust(main, wt, files.agy)).toBe("sin confianza");
			expect(readFileSync(files.agy, "utf8")).toBe(before);
		}
		expect(inheritAgyTrust(main, wt, join(dir, "no-existe.json"))).toBe("sin confianza");
	});

	test("inheritTrust lo enruta a settings.json de agy", () => {
		writeFileSync(files.agy, JSON.stringify(settings([key(main)])));
		expect(inheritTrust("agy", main, wt, files)).toBe("heredada");
	});
});

test("otros agentes: no aplica", () => {
	expect(inheritTrust("codex", main, wt, files)).toBe("no aplica");
	expect(existsSync(files.pi) || existsSync(files.claude) || existsSync(files.agy)).toBe(false);
});

describe("con la confianza del orquestador (vouched)", () => {
	const key = (p: string) => p.replace(/\\/g, "/");

	test("trusts: lee la confianza de cada agente en el checkout principal, sin escribir", () => {
		writeFileSync(files.pi, JSON.stringify({ [join("/", "src")]: true }));
		writeFileSync(files.claude, JSON.stringify({ projects: { [key(main)]: { hasTrustDialogAccepted: true } } }));
		writeFileSync(files.agy, JSON.stringify({ trustedWorkspaces: ["/otro"] }));
		expect(trusts("pi", main, files)).toBe(true);
		expect(trusts("claude", main, files)).toBe(true);
		expect(trusts("agy", main, files)).toBe(false);
		expect(trusts("codex", main, files)).toBe(false);
		writeFileSync(files.pi, "{roto");
		expect(trusts("pi", main, files)).toBe(false);
	});

	test("agy sin el checkout en trustedWorkspaces: añade el worktree igualmente", () => {
		writeFileSync(files.agy, JSON.stringify({ model: "Gemini", trustedWorkspaces: ["/otro"] }));
		expect(inheritTrust("agy", main, wt, files, true)).toBe("heredada");
		expect(read(files.agy)).toEqual({ model: "Gemini", trustedWorkspaces: ["/otro", key(wt)] });
		writeFileSync(files.agy, JSON.stringify({ model: "Gemini" }));
		expect(inheritAgyTrust(main, wt, files.agy, true)).toBe("heredada");
		expect(read(files.agy).trustedWorkspaces).toEqual([key(wt)]);
		rmSync(files.agy);
		expect(inheritAgyTrust(main, wt, files.agy, true)).toBe("heredada");
		expect(read(files.agy)).toEqual({ trustedWorkspaces: [key(wt)] });
	});

	test("pi y Claude Code sin confianza propia en el checkout: la reciben", () => {
		writeFileSync(files.pi, JSON.stringify({ "/otro": true }));
		expect(inheritTrust("pi", main, wt, files, true)).toBe("heredada");
		expect(read(files.pi)[wt]).toBe(true);
		writeFileSync(files.claude, JSON.stringify({ numStartups: 1 }));
		expect(inheritTrust("claude", main, wt, files, true)).toBe("heredada");
		expect(read(files.claude).projects[key(wt)]).toMatchObject({ hasTrustDialogAccepted: true });
	});

	test("respeta un no tuyo en el worktree de pi y no crea ~/.claude.json", () => {
		writeFileSync(files.pi, JSON.stringify({ [wt]: false }));
		expect(inheritPiTrust(main, wt, files.pi, true)).toBe("sin confianza");
		expect(inheritClaudeTrust(main, wt, files.claude, true)).toBe("sin confianza");
		expect(existsSync(files.claude)).toBe(false);
	});
});
