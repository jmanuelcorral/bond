// Operaciones de herdr-core (`hc`) que usa bond: terminales, agentes, envío y lectura.
// `hc` responde JSON bajo stdout; los errores, JSON en stderr { error: { kind, message, hint } }.

import { t } from "./messages.mts";
import { die, run, which } from "./util.mts";

export interface HcTerminal {
	address: string;
	agent?: string;
	name?: string;
	cwd?: string;
	state?: string;
	status?: unknown;
	exit_code?: number | null;
	turn?: number;
	labels?: Record<string, string>;
	where?: string;
}

export interface HcLsResult {
	terminals?: HcTerminal[];
	hidden_finished?: number;
}

/** Ejecuta `hc <args>` y devuelve su JSON parseado de stdout, o lanza un error. */
export function hc<T = unknown>(args: string[], timeout = 60_000): T {
	const r = run("hc", args, { timeout });
	let parsed: T | { error?: { kind?: string; message?: string } } | undefined;
	try {
		parsed = JSON.parse(r.stdout || r.stderr || "{}");
	} catch {
		// No JSON
	}
	if (r.status !== 0 || (parsed && typeof parsed === "object" && "error" in parsed && (parsed as { error?: unknown }).error)) {
		const errObj = parsed && typeof parsed === "object" && "error" in parsed ? (parsed as { error?: { message?: string; kind?: string } }).error : undefined;
		const msg = errObj?.message ?? ((r.stderr || r.stdout).trim() || `hc ${args.join(" ")} falló`);
		const err = new Error(msg) as Error & { kind?: string; code?: number };
		err.kind = errObj?.kind;
		err.code = r.status ?? undefined;
		throw err;
	}
	return parsed as T;
}

export function requireHc(): void {
	if (!which("hc")) die(t("team.err_hc_not_installed"));
}

/** Lista terminales activas de hc. */
export function hcTerminals(labels?: Record<string, string>): HcTerminal[] {
	try {
		const labelArgs = labels ? Object.entries(labels).flatMap(([k, v]) => ["--label", `${k}=${v}`]) : [];
		const res = hc<HcLsResult>(["ls", "--json", ...labelArgs], 15_000);
		return res.terminals ?? [];
	} catch {
		return [];
	}
}

/** Obtiene detalles de una terminal por dirección o nombre. */
export function hcGet(terminalOrName: string): HcTerminal | undefined {
	try {
		return hc<HcTerminal>(["get", terminalOrName, "--json"], 15_000);
	} catch {
		return undefined;
	}
}

/**
 * Arranca un comando/agente en una terminal en segundo plano.
 * Usa --bg --keep --no-parent para que no muera con el proceso que lo lanza y se mantenga viva.
 */
export function hcRun(opts: {
	name: string;
	cwd: string;
	argv: string[];
	labels?: Record<string, string>;
}): { address: string; name?: string } {
	const labelArgs = opts.labels ? Object.entries(opts.labels).flatMap(([k, v]) => ["--label", `${k}=${v}`]) : [];
	const res = hc<{ address?: string; name?: string }>(
		["run", "--bg", "--keep", "--no-parent", "--name", opts.name, "--cwd", opts.cwd, ...labelArgs, "--", ...opts.argv],
		30_000,
	);
	if (!res.address) throw new Error("hc run no devolvió address");
	return { address: res.address, name: res.name ?? opts.name };
}

/** Envía texto/tarea a una terminal (`hc send`). */
export function hcSend(terminalOrName: string, text: string, opts: { force?: boolean; wait?: boolean; timeout?: number } = {}): { status?: string; turn?: number } {
	const extra: string[] = [];
	if (opts.force) extra.push("--force");
	if (opts.wait) extra.push("--wait");
	if (opts.timeout) extra.push("--timeout", String(Math.max(1, Math.round(opts.timeout / 1000))));
	const res = hc<{ status?: string; turn?: number }>(["send", "--json", ...extra, "--", terminalOrName, text], (opts.timeout ?? 30_000) + 10_000);
	return res ?? {};
}

/** Lee la pantalla y el historial reciente de una terminal (`hc read`). */
export function hcRead(terminalOrName: string, lines = 200): string {
	const r = run("hc", ["read", "--lines", String(lines), terminalOrName], { timeout: 20_000 });
	if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim() || `hc read ${terminalOrName} falló`);
	return r.stdout;
}

/** Finaliza el programa de una terminal (`hc kill`). */
export function hcKill(terminalOrName: string): void {
	try {
		hc(["kill", terminalOrName, "--json"], 15_000);
	} catch {}
}

/** Elimina una terminal finalizada (`hc rm`). */
export function hcRm(terminalOrName: string): void {
	try {
		hc(["rm", terminalOrName, "--json"], 15_000);
	} catch {}
}

/** Extrae el estado del agente normalizado a string (idle, working, blocked, done, error...). */
export function hcAgentStatus(status: unknown): string | undefined {
	if (typeof status === "string") return status || undefined;
	if (status && typeof status === "object" && typeof (status as { state?: unknown }).state === "string") {
		return (status as { state: string }).state || undefined;
	}
	return undefined;
}
