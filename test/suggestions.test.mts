// Sugerencias de prompt de pi: elección del modelo, merge del config de supi, enabledModels y
// lo que escribe applySuggestions (y lo que no escribe en dry-run o al desactivar).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Config, type Provider } from "../cli/config.mts";
import {
	DISABLED,
	SUGGESTIONS_PACKAGE,
	applySuggestions,
	enabledModelsCover,
	isPackageDeclared,
	mergeSupiConfig,
	otherEditorExtensions,
	pickSuggestionModel,
	readSupiModel,
	type SuggestionPaths,
	withEnabledModels,
} from "../cli/suggestions.mts";

const provider = (id: string, extra: Partial<Provider> = {}, models: { id: string; name?: string; agents?: string[]; enabled?: boolean }[] = []): Provider => ({
	id,
	base_url: `http://${id}.invalid/v1`,
	models: models.map((m) => ({ ...m })),
	...extra,
});

const cfg = (providers: Provider[]): Config => ({ agents: ["pi"], providers });

describe("elección del modelo de sugerencias", () => {
	test("prefiere los proveedores de coste cero", () => {
		const c = cfg([provider("pago", {}, [{ id: "gpt-big" }]), provider("gratis", { free: true }, [{ id: "local-uno" }])]);
		expect(pickSuggestionModel(c)).toBe("gratis/local-uno");
	});

	test("dentro de los gratuitos elige el de nombre barato", () => {
		const c = cfg([provider("gratis", { free: true }, [{ id: "modelo-grande" }, { id: "haiku-mini" }, { id: "otro-normal" }])]);
		expect(pickSuggestionModel(c)).toBe("gratis/haiku-mini");
	});

	test("sin gratuitos usa el resto con el mismo criterio", () => {
		const c = cfg([provider("pago", {}, [{ id: "grande" }, { id: "flash-lite" }])]);
		expect(pickSuggestionModel(c)).toBe("pago/flash-lite");
	});

	test("respeta el orden del registro cuando ninguno destaca", () => {
		const c = cfg([provider("pago", {}, [{ id: "alfa" }, { id: "beta" }])]);
		expect(pickSuggestionModel(c)).toBe("pago/alfa");
	});

	test("no propone modelos restringidos a otros agentes ni proveedores apagados", () => {
		const c = cfg([
			provider("apagado", { free: true, enabled: false }, [{ id: "mini" }]),
			provider("solo-codex", { free: true }, [{ id: "nano", agents: ["codex"] }]),
			provider("pi", { free: true }, [{ id: "flash" }]),
		]);
		expect(pickSuggestionModel(c)).toBe("pi/flash");
	});

	test("un registro vacío no propone nada", () => {
		expect(pickSuggestionModel(cfg([]))).toBeUndefined();
		expect(pickSuggestionModel(cfg([provider("vacio", { free: true }, [])]))).toBeUndefined();
	});
});

describe("merge del config de supi", () => {
	test("conserva las secciones de otros paquetes", () => {
		const existing = { otherPackage: { keep: 1 }, promptSuggestions: { model: "viejo/malo", verbosity: 2 } };
		const merged = mergeSupiConfig(existing, "gratis/mini");
		expect(merged.otherPackage).toEqual({ keep: 1 });
		expect(merged.promptSuggestions).toEqual({ model: "gratis/mini", verbosity: 2 });
	});

	test("crea la sección si no estaba", () => {
		expect(mergeSupiConfig(null, "gratis/mini")).toEqual({ promptSuggestions: { model: "gratis/mini" } });
	});

	test("una sección que no es un objeto no rompe: se sustituye", () => {
		const merged = mergeSupiConfig({ promptSuggestions: "cosas raras" }, "gratis/mini");
		expect(merged.promptSuggestions).toEqual({ model: "gratis/mini" });
	});
});

describe("enabledModels de pi", () => {
	test("pone [\"*\"] cuando no estaba", () => {
		const r = withEnabledModels(null);
		expect(r.changed).toBe(true);
		expect(r.settings.enabledModels).toEqual(["*"]);
	});

	test("una lista vacía cuenta como no puesta", () => {
		expect(withEnabledModels({ enabledModels: [] }).changed).toBe(true);
	});

	test("una lista puesta por el usuario se respeta", () => {
		const r = withEnabledModels({ enabledModels: ["halo/flash-halogen"], theme: "dark" });
		expect(r.changed).toBe(false);
		expect(r.settings).toEqual({ enabledModels: ["halo/flash-halogen"], theme: "dark" });
	});

	test("un valor que no es lista se reemplaza", () => {
		expect(withEnabledModels({ enabledModels: "todas" }).changed).toBe(true);
	});
});

describe("paquete ya declarado en la config de pi", () => {
	test("reconoce la forma string y la de objeto", () => {
		expect(isPackageDeclared({ packages: ["~/.bond/pi", "npm:@mrclrchtr/supi-prompt-suggestions@1.0.0"] })).toBe(true);
		expect(isPackageDeclared({ packages: [{ source: "npm:@mrclrchtr/supi-prompt-suggestions@11.0.1" }] })).toBe(true);
	});

	test("sin el paquete, no", () => {
		expect(isPackageDeclared({ packages: ["~/.bond/pi"] })).toBe(false);
		expect(isPackageDeclared(null)).toBe(false);
	});
});

describe("applySuggestions", () => {
	let dir: string;
	let paths: SuggestionPaths;
	let installs: string[];
	const okInstall = (pkg: string) => {
		installs.push(pkg);
		return { ok: true, message: "" };
	};

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "bond-sugg-"));
		mkdirSync(join(dir, "pi-agent"), { recursive: true });
		paths = { supiConfig: join(dir, "supi-config.json"), piSettings: join(dir, "pi-settings.json") };
		installs = [];
	});

	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	const read = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, any>;

	test("activa: escribe el modelo, deja enabledModels e instala el paquete fijado", () => {
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		const r = applySuggestions(c, { paths, install: okInstall });
		expect(r).toMatchObject({ enabled: true, model: "gratis/haiku-mini", installed: true, enabledModelsChanged: true });
		expect(read(paths.supiConfig).promptSuggestions.model).toBe("gratis/haiku-mini");
		expect(read(paths.piSettings).enabledModels).toEqual(["*"]);
		expect(installs).toEqual([SUGGESTIONS_PACKAGE]);
	});

	test("el modelo explícito de [suggestions] manda sobre la heurística", () => {
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		c.suggestions = { model: "gratis/modelo-grande" };
		expect(applySuggestions(c, { paths, install: okInstall }).model).toBe("gratis/modelo-grande");
	});

	test("no pisa enabledModels ni claves ajenas de la config de pi", () => {
		writeFileSync(paths.piSettings, JSON.stringify({ enabledModels: ["halo/flash-halogen"], theme: "dark" }));
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		const r = applySuggestions(c, { paths, install: okInstall });
		expect(r.enabledModelsChanged).toBe(false);
		expect(read(paths.piSettings)).toEqual({ enabledModels: ["halo/flash-halogen"], theme: "dark" });
	});

	test("si ya estaba declarado no vuelve a instalar", () => {
		writeFileSync(paths.piSettings, JSON.stringify({ packages: ["npm:@mrclrchtr/supi-prompt-suggestions@9.9.9"] }));
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		const r = applySuggestions(c, { paths, install: okInstall });
		expect(r.installed).toBe(true);
		expect(installs).toEqual([]);
	});

	test("desactivar solo escribe disabled y no toca pi ni instala", () => {
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		c.suggestions = { enabled: false };
		const r = applySuggestions(c, { paths, install: okInstall });
		expect(r.enabled).toBe(false);
		expect(read(paths.supiConfig).promptSuggestions.model).toBe(DISABLED);
		expect(existsSync(paths.piSettings)).toBe(false);
		expect(installs).toEqual([]);
	});

	test("desactivar conserva las secciones de otros paquetes de supi", () => {
		writeFileSync(paths.supiConfig, JSON.stringify({ otherPackage: { keep: 1 } }));
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		c.suggestions = { enabled: false };
		applySuggestions(c, { paths, install: okInstall });
		expect(read(paths.supiConfig)).toEqual({ otherPackage: { keep: 1 }, promptSuggestions: { model: DISABLED } });
	});

	test("sin modelos en el registro no escribe nada", () => {
		const r = applySuggestions(cfg([]), { paths, install: okInstall });
		expect(r.enabled).toBe(false);
		expect(r.notes.join(" ")).toContain("no tiene modelos");
		expect(existsSync(paths.supiConfig)).toBe(false);
		expect(existsSync(paths.piSettings)).toBe(false);
		expect(installs).toEqual([]);
	});

	test("un fallo al instalar no corta: avisa y deja el config escrito", () => {
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		const r = applySuggestions(c, {
			paths,
			install: (pkg) => {
				installs.push(pkg);
				return { ok: false, message: "sin red" };
			},
		});
		expect(r.installed).toBe(false);
		expect(r.notes.join(" ")).toContain("sin red");
		expect(read(paths.supiConfig).promptSuggestions.model).toBe("gratis/haiku-mini");
	});

	test("dry-run no escribe ni instala", async () => {
		const { setDryRun } = await import("../cli/util.mts");
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		setDryRun(true);
		try {
			const r = applySuggestions(c, { paths, install: okInstall });
			expect(r.enabled).toBe(true);
			expect(existsSync(paths.supiConfig)).toBe(false);
			expect(existsSync(paths.piSettings)).toBe(false);
			expect(installs).toEqual([]);
		} finally {
			setDryRun(false);
		}
	});

	test("guarda copia .prev del config de supi antes de tocarlo", () => {
		writeFileSync(paths.supiConfig, JSON.stringify({ promptSuggestions: { model: "viejo/uno" } }));
		const c = cfg([provider("gratis", { free: true }, [{ id: "haiku-mini" }])]);
		applySuggestions(c, { paths, install: okInstall });
		expect(read(`${paths.supiConfig}.prev`).promptSuggestions.model).toBe("viejo/uno");
		expect(read(paths.supiConfig).promptSuggestions.model).toBe("gratis/haiku-mini");
	});
});

describe("lecturas que usa bond doctor", () => {
	let dir: string;
	let paths: SuggestionPaths;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "bond-sugg-read-"));
		paths = { supiConfig: join(dir, "supi-config.json"), piSettings: join(dir, "pi-settings.json") };
	});

	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	test("enabledModelsCover: todos, por proveedor y exacto", () => {
		expect(enabledModelsCover("halo/flash", ["*"])).toBe(true);
		expect(enabledModelsCover("halo/flash", ["halo/*"])).toBe(true);
		expect(enabledModelsCover("halo/flash", ["ollama/*", "halo/flash"])).toBe(true);
	});

	test("enabledModelsCover: fuera del listado o sin lista, no", () => {
		expect(enabledModelsCover("halo/flash", ["anthropic/*"])).toBe(false);
		expect(enabledModelsCover("halo/flash", [])).toBe(false);
		expect(enabledModelsCover("halo/flash", undefined)).toBe(false);
		expect(enabledModelsCover("halo/flash", ["halo/flashx"])).toBe(false);
	});

	test("readSupiModel: lo que hay en la seccion; undefined si no", () => {
		writeFileSync(paths.supiConfig, JSON.stringify({ promptSuggestions: { model: "halo/flash" } }));
		expect(readSupiModel(paths)).toBe("halo/flash");
		expect(readSupiModel({ ...paths, supiConfig: join(dir, "no-existe.json") })).toBeUndefined();
		writeFileSync(paths.supiConfig, JSON.stringify({ other: { model: "no es mi seccion" } }));
		expect(readSupiModel(paths)).toBeUndefined();
	});

	test("otherEditorExtensions: solo ficheros que usan setEditorComponent", () => {
		mkdirSync(join(dir, "extensions"), { recursive: true });
		writeFileSync(join(dir, "extensions", "mi-editor.ts"), "pi.ui.setEditorComponent(makeEditor())");
		writeFileSync(join(dir, "extensions", "inocuo.ts"), "pi.events.on('turn_end', () => {})");
		writeFileSync(join(dir, "extensions", "nota.md"), "setEditorComponent en un markdown no cuenta");
		expect(otherEditorExtensions(join(dir, "extensions"))).toEqual(["mi-editor.ts"]);
	});

	test("otherEditorExtensions: directorio ausente, lista vacia", () => {
		expect(otherEditorExtensions(join(dir, "nadie"))).toEqual([]);
	});
});
