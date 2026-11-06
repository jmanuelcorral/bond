// Pruebas del probe de `bond models` (#76): clasificar la respuesta inspeccionando el
// cuerpo, no solo el status HTTP. Los stubs reproducen la evidencia de la issue:
// modelos razonadores que con presupuesto pequeño devuelven 200 sin contenido util.

import { describe, expect, test } from "bun:test";
import { classifyProbe } from "../cli/models.mts";

describe("classifyProbe: chat/completions", () => {
	test("contenido normal → ok", () => {
		expect(classifyProbe("chat", 200, { choices: [{ message: { content: "listo" }, finish_reason: "stop" }] })).toBe("ok");
	});

	test("content null con reasoning_content y finish length → empty_reasoning", () => {
		expect(
			classifyProbe("chat", 200, {
				choices: [{ message: { content: null, reasoning_content: "El usuario dice ok, pienso..." }, finish_reason: "length" }],
			}),
		).toBe("empty_reasoning");
	});

	test("content en blanco sin ninguna señal → empty_reasoning (no hay nada utilizable)", () => {
		expect(classifyProbe("chat", 200, { choices: [{ message: { content: "   " }, finish_reason: "stop" }] })).toBe("empty_reasoning");
	});

	test("sin choices → empty_reasoning", () => {
		expect(classifyProbe("chat", 200, {})).toBe("empty_reasoning");
	});
});

describe("classifyProbe: responses", () => {
	test("output_text con contenido → ok", () => {
		expect(classifyProbe("responses", 200, { status: "completed", output_text: "hola" })).toBe("ok");
	});

	test("bloque output_text dentro de output → ok", () => {
		expect(
			classifyProbe("responses", 200, {
				status: "completed",
				output: [{ type: "message", content: [{ type: "output_text", text: "va" }] }],
			}),
		).toBe("ok");
	});

	test("incomplete por max_output_tokens sin texto → empty_reasoning", () => {
		expect(
			classifyProbe("responses", 200, {
				status: "incomplete",
				incomplete_details: { reason: "max_output_tokens" },
				output: [{ type: "reasoning", content: "..." }],
			}),
		).toBe("empty_reasoning");
	});
});

describe("classifyProbe: messages (Anthropic)", () => {
	test("bloque text con contenido → ok", () => {
		expect(classifyProbe("messages", 200, { content: [{ type: "text", text: "hola" }] })).toBe("ok");
	});

	test("solo bloques thinking, ningún text → empty_reasoning", () => {
		expect(classifyProbe("messages", 200, { content: [{ type: "thinking", thinking: "rumiando" }], stop_reason: "max_tokens" })).toBe("empty_reasoning");
	});
});

describe("classifyProbe: fallos", () => {
	test("HTTP != 2xx → fail con independencia del cuerpo", () => {
		expect(classifyProbe("chat", 500, { choices: [{ message: { content: "nada" } }] })).toBe("fail");
		expect(classifyProbe("responses", 401, { error: "unauthorized" })).toBe("fail");
		expect(classifyProbe("messages", 429, { error: "rate limited" })).toBe("fail");
	});

	test("cuerpo no parseable (null) → fail", () => {
		expect(classifyProbe("chat", 200, null)).toBe("fail");
		expect(classifyProbe("messages", 200, undefined)).toBe("fail");
	});
});
