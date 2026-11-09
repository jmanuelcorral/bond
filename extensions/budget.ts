/**
 * Extensión de presupuesto para pi (epic #84, issue #86).
 *
 * Registra eventos en ~/.bond/events/ (el mismo canal que usan los hooks de los demás
 * agentes) ante cambios de sesión, final de turnos y respuestas del proveedor HTTP.
 * Fail-open: cualquier error se traga y jamás interrumpe la ejecución del agente pi.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ExtensionContext {
	sessionManager?: {
		getSessionId?: () => string | undefined;
		getSessionFile?: () => string | undefined;
	};
	cwd?: string;
}

export interface AfterProviderResponseEvent {
	status: number;
	headers: Record<string, string>;
}

export interface ExtensionAPI {
	on(event: "session_start" | "session_shutdown" | "session_before_compact" | "session_compact" | "agent_end", handler: (event: unknown, ctx: ExtensionContext) => void | Promise<void>): void;
	on(event: "after_provider_response", handler: (event: AfterProviderResponseEvent, ctx: ExtensionContext) => void | Promise<void>): void;
	on(event: string, handler: (event: any, ctx: ExtensionContext) => void | Promise<void>): void;
}

/** Directorio de eventos (~/.bond/events o BOND_EVENTS_DIR). */
export function eventsDir(): string {
	return process.env.BOND_EVENTS_DIR ?? join(process.env.BOND_HOME || join(homedir(), ".bond"), "events");
}

/** Escribe un evento de pi en el canal común de eventos. Fail-open absoluto. */
export function appendPiEvent(ev: {
	event: string;
	ts?: string;
	session_id?: string;
	transcript_path?: string;
	cwd?: string;
	status?: number;
	headers?: Record<string, string | undefined>;
	detail?: string;
}): void {
	try {
		const dir = eventsDir();
		mkdirSync(dir, { recursive: true });
		const ts = typeof ev.ts === "string" ? ev.ts : new Date().toISOString();
		const day = ts.slice(0, 10);
		const line = JSON.stringify({ ...ev, ts, agent: "pi" });
		appendFileSync(join(dir, `${day}.jsonl`), `${line}\n`);
	} catch {
		// Fail-open: un error de telemetría de presupuesto jamás debe bloquear pi.
	}
}

export function budgetExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "session_start",
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});

	pi.on("session_shutdown", async (_event: unknown, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "session_end",
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});

	pi.on("session_before_compact", async (_event: unknown, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "pre_compact",
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});

	pi.on("session_compact", async (_event: unknown, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "compact",
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});

	pi.on("agent_end", async (_event: unknown, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "stop",
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});

	pi.on("after_provider_response", (event: AfterProviderResponseEvent, ctx: ExtensionContext) => {
		appendPiEvent({
			event: "provider_response",
			status: event.status,
			headers: event.headers,
			session_id: ctx.sessionManager?.getSessionId?.(),
			transcript_path: ctx.sessionManager?.getSessionFile?.(),
			cwd: ctx.cwd,
		});
	});
}

export default budgetExtension;
