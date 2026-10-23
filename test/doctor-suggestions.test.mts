// bond doctor: la fila de sugerencias de prompt (modelo, paquete, enabledModels, config de la
// extensión y otras extensiones que reemplazan el editor).

import { describe, expect, test } from "bun:test";
import { suggestionsCheck, type SuggestionsState } from "../cli/doctor.mts";

const state = (over: Partial<SuggestionsState> = {}): SuggestionsState => ({
	enabled: true,
	resolvedModel: "halo/flash-halogen",
	supiModel: "halo/flash-halogen",
	installed: true,
	enabledModels: ["*"],
	...over,
});

describe("fila de sugerencias", () => {
	test("todo en su sitio: ok y sin arreglo", () => {
		const r = suggestionsCheck(state());
		expect(r.level).toBe("ok");
		expect(r.name).toBe("sugerencias");
		expect(r.fix).toBeUndefined();
		expect(r.detail).toContain("halo/flash-halogen");
		expect(r.detail).toContain("paquete instalado");
		expect(r.detail).toContain("enabledModels: todos");
	});

	test("el modelo explícito de [suggestions] manda sobre el resuelto", () => {
		const r = suggestionsCheck(state({ configuredModel: "halo/otro", resolvedModel: "halo/flash-halogen", supiModel: "halo/otro" }));
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("halo/otro");
		expect(r.detail).not.toContain("flash-halogen");
	});

	test("paquete sin instalar avisa y manda a bond setup", () => {
		const r = suggestionsCheck(state({ installed: false }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("paquete no instalado");
		expect(r.fix).toBe("bond setup");
	});

	test("el config de la extensión no coincide con config.toml", () => {
		const r = suggestionsCheck(state({ supiModel: "viejo/uno" }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("la extensión tiene: viejo/uno");
		expect(r.fix).toBe("bond setup");
	});

	test("la extensión sin configurar también es un desajuste", () => {
		const r = suggestionsCheck(state({ supiModel: undefined }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("la extensión tiene: nada");
	});

	test("enabledModels sin poner: la extensión no ve modelos", () => {
		expect(suggestionsCheck(state({ enabledModels: undefined })).level).toBe("warn");
		const r = suggestionsCheck(state({ enabledModels: [] }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("enabledModels: sin poner");
	});

	test("enabledModels que no cubre el elegido avisa", () => {
		const r = suggestionsCheck(state({ enabledModels: ["anthropic/claude-opus"] }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("queda fuera de enabledModels");
	});

	test("un patron de proveedor si cubre el modelo", () => {
		const r = suggestionsCheck(state({ enabledModels: ["halo/*"] }));
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("enabledModels: halo/*");
	});

	test("una lista de varios patrones se enseña entera", () => {
		const r = suggestionsCheck(state({ enabledModels: ["halo/*", "ollama/*"] }));
		expect(r.level).toBe("ok");
		expect(r.detail).toContain("halo/*, ollama/*");
	});

	test("otra extensión que reemplaza el editor se señala", () => {
		const r = suggestionsCheck(state({ otherEditors: ["mi-editor.ts"] }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("otras extensiones de editor: mi-editor.ts");
		expect(r.fix).toBe("bond setup");
	});

	test("desactivadas no es un problema", () => {
		const r = suggestionsCheck(state({ enabled: false, installed: false, enabledModels: undefined, supiModel: "disabled" }));
		expect(r.level).toBe("ok");
		expect(r.detail).toBe("desactivadas ([suggestions] enabled = false)");
		expect(r.fix).toBe("bond setup");
	});

	test("sin modelo en el registro manda bond models init", () => {
		const r = suggestionsCheck(state({ resolvedModel: undefined }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("sin modelo");
		expect(r.fix).toBe("bond models init");
	});

	test("varios problemas se acumulan en un solo aviso", () => {
		const r = suggestionsCheck(state({ installed: false, supiModel: undefined, enabledModels: undefined }));
		expect(r.level).toBe("warn");
		expect(r.detail).toContain("paquete no instalado");
		expect(r.detail).toContain("enabledModels: sin poner");
		expect(r.detail).toContain("la extensión tiene: nada");
	});
});
