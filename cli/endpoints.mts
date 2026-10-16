// Endpoints de modelos: detectar los locales, listar sus modelos y probar qué APIs sirven.

import type { Api } from "./config.mts";

export interface EndpointModel {
	id: string;
	context?: number;
	max_output?: number;
}

/** Endpoints locales conocidos: se detectan sin preguntar. */
export const LOCAL_ENDPOINTS = [
	{ kind: "ollama", id: "ollama", name: "Ollama", base_url: "http://localhost:11434/v1" },
	{ kind: "lmstudio", id: "lmstudio", name: "LM Studio", base_url: "http://localhost:1234/v1" },
];

const headers = (key?: string): Record<string, string> => (key ? { authorization: `Bearer ${key}`, "x-api-key": key } : {});
const trim = (base: string) => base.replace(/\/+$/, "");

/** GET /models. Devuelve undefined si no responde (no es un endpoint compatible con OpenAI). */
export async function listModels(base: string, key?: string, timeoutMs = 10_000): Promise<EndpointModel[] | undefined> {
	try {
		const res = await fetch(`${trim(base)}/models`, { headers: headers(key), signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return undefined;
		const data = ((await res.json()) as { data?: Array<Record<string, unknown>> }).data;
		if (!Array.isArray(data)) return undefined;
		return data.map((m) => {
			// Algunas pasarelas (llama-swap) publican el contexto y la salida máxima.
			const meta = (m.meta as Record<string, Record<string, unknown>> | undefined)?.llamaswap;
			const context = Number(m.context_window ?? m.context_length ?? meta?.context_window) || undefined;
			const max_output = Number(meta?.max_output_tokens ?? m.max_output_tokens) || undefined;
			return { id: String(m.id), context, max_output };
		});
	} catch {
		return undefined;
	}
}

async function post(url: string, body: unknown, extra: Record<string, string>): Promise<{ ok: boolean; text: string }> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...extra },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000), // la primera petición puede cargar el modelo en RAM
		});
		return { ok: res.ok, text: await res.text() };
	} catch {
		return { ok: false, text: "" };
	}
}

export interface ProbeResult {
	apis: Api[];
	/** La respuesta de chat trae razonamiento (reasoning_content): el modelo razona. */
	reasoning: boolean;
}

/**
 * Qué APIs sirve un endpoint para un modelo: chat (/chat/completions), responses (/responses)
 * y messages (la de Anthropic, /messages). Una petición tras otra: las pasarelas locales no
 * suelen atender varias a la vez (429).
 */
export async function probeApis(base: string, model: string, key?: string): Promise<ProbeResult> {
	const b = trim(base);
	const h = headers(key);
	const apis: Api[] = [];
	const chat = await post(`${b}/chat/completions`, { model, messages: [{ role: "user", content: "ok" }], max_tokens: 8 }, h);
	if (chat.ok) apis.push("chat");
	if ((await post(`${b}/responses`, { model, input: "ok", max_output_tokens: 16 }, h)).ok) apis.push("responses");
	if ((await post(`${b}/messages`, { model, max_tokens: 8, messages: [{ role: "user", content: "ok" }] }, { ...h, "anthropic-version": "2023-06-01" })).ok) apis.push("messages");
	return { apis, reasoning: chat.ok && /"reasoning(_content)?"\s*:\s*"[^"]/.test(chat.text) };
}
