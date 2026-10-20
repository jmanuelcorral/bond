// `bond sessions`: sesiones de pi de todos los proyectos con el comando para retomarlas, y el
// agente de Herdr que las tiene abiertas. Idea tomada de pi-sessions de Jeyapaul/pi (MIT).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agents } from "./herdr.mts";
import { AGENT_DIR, die } from "./util.mts";

const USAGE = `Uso: bond sessions [texto] [opciones]

Lista las sesiones de pi, de la más reciente a la más antigua, con el comando para
retomarlas. Las que están abiertas en un agente de Herdr muestran agente, estado y panel.

  texto            Filtra por nombre de sesión, directorio o id
  --here           Solo las sesiones del directorio actual
  --live           Solo las abiertas ahora en Herdr
  -n, --limit <N>  Cuántas mostrar (defecto: 20; 0 = todas)
  --json           Salida JSON para scripts
  -h, --help       Esta ayuda

Retomar: cd <directorio> && pi --session <id>. pi busca el id primero en las sesiones
del directorio actual; por eso el comando hace cd antes.`;

interface Session {
	id: string;
	cwd?: string;
	name: string;
	msgs: number;
	cost: number;
	model: string;
	file: string;
	mtime: number;
}

interface LiveAgent {
	name: string;
	status: string;
	pane: string;
}

const sessionsDir = () => process.env.PI_CODING_AGENT_SESSION_DIR || join(AGENT_DIR, "sessions");

/** Cabecera, nombre (el último session_info gana), mensajes del asistente y coste. */
function readSession(file: string): Omit<Session, "file" | "mtime"> | null {
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		return null;
	}
	let id: string | undefined;
	let cwd: string | undefined;
	let name = "";
	let msgs = 0;
	let cost = 0;
	let model = "";
	for (const line of text.split("\n")) {
		if (!line) continue;
		const isHeader = id === undefined && line.includes('"type":"session"');
		const isInfo = line.includes('"session_info"');
		const isAssistant = line.includes('"role":"assistant"');
		if (!isHeader && !isInfo && !isAssistant) continue;
		let e: Record<string, any>;
		try {
			e = JSON.parse(line);
		} catch {
			continue;
		}
		if (e.type === "session") {
			id = e.id;
			cwd = e.cwd;
		} else if (e.type === "session_info" && typeof e.name === "string") {
			name = e.name;
		} else if (e.type === "message" && e.message?.role === "assistant") {
			msgs++;
			cost += e.message.usage?.cost?.total ?? 0;
			model = e.message.model || model;
		}
	}
	return id ? { id, cwd, name, msgs, cost, model } : null;
}

function listSessions(): Session[] {
	const out: Session[] = [];
	let dirs: string[] = [];
	try {
		dirs = readdirSync(sessionsDir(), { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => join(sessionsDir(), d.name));
	} catch {
		return out;
	}
	for (const dir of dirs) {
		for (const f of readdirSync(dir)) {
			if (!f.endsWith(".jsonl")) continue;
			const file = join(dir, f);
			const info = readSession(file);
			if (info) out.push({ ...info, file, mtime: statSync(file).mtimeMs });
		}
	}
	return out.sort((a, b) => b.mtime - a.mtime);
}

/** Fichero de sesión -> agente de Herdr que lo tiene abierto (agent_session.value). */
function liveAgents(): Map<string, LiveAgent> {
	const map = new Map<string, LiveAgent>();
	// Sin Herdr o sin servidor, agents() devuelve [] y se listan las sesiones sin esa columna.
	for (const a of agents(3000)) {
		const file = a.agent_session?.kind === "path" ? a.agent_session.value : undefined;
		if (file) map.set(file, { name: a.name || "", status: a.agent_status || "?", pane: a.pane_id });
	}
	return map;
}

/** Prefijo de id más corto (mínimo 8) que no comparte ninguna otra sesión. Los UUIDv7 empiezan por la hora. */
function shortIds(sessions: Session[]): Map<string, string> {
	const ids = sessions.map((s) => s.id);
	return new Map(
		ids.map((id) => {
			let n = 8;
			while (n < id.length && ids.some((o) => o !== id && o.startsWith(id.slice(0, n)))) n++;
			return [id, id.slice(0, n)] as const;
		}),
	);
}

const home = homedir();
const tilde = (p: string | undefined) => (p && p.startsWith(home) ? `~${p.slice(home.length)}` : p || "?");
const shellQuote = (s: string) => (/^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replaceAll("'", "'\\''")}'`);

function fmtDate(ms: number): string {
	const d = new Date(ms);
	const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
	if (new Date().toDateString() === d.toDateString()) return `hoy ${hm}`;
	return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
}

export function sessions(args: string[]): void {
	let here = false;
	let live = false;
	let json = false;
	let limit = 20;
	let query = "";
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "-h" || a === "--help") return console.log(USAGE);
		if (a === "--here") here = true;
		else if (a === "--live") live = true;
		else if (a === "--json") json = true;
		else if (a === "-n" || a === "--limit") {
			limit = Number(args[++i]);
			if (!Number.isInteger(limit) || limit < 0) die(`${a} necesita un entero >= 0`);
		} else if (a.startsWith("-")) die(`opción desconocida: ${a} (--help para ver las opciones)`);
		else query = a.toLowerCase();
	}

	const all = listSessions();
	const ids = shortIds(all);
	const live_ = liveAgents();
	const cwdNow = process.cwd();

	let rows = all.map((s) => ({
		...s,
		shortId: ids.get(s.id) ?? s.id,
		agent: live_.get(s.file),
		exists: !!s.cwd && existsSync(s.cwd),
		resume: `cd ${shellQuote(tilde(s.cwd))} && pi --session ${ids.get(s.id)}`,
	}));
	if (here) rows = rows.filter((r) => r.cwd === cwdNow);
	if (live) rows = rows.filter((r) => r.agent);
	if (query) rows = rows.filter((r) => [r.name, r.cwd, r.id].some((v) => v && v.toLowerCase().includes(query)));
	const total = rows.length;
	if (limit > 0) rows = rows.slice(0, limit);

	if (json) return console.log(JSON.stringify(rows.map(({ shortId, ...r }) => ({ ...r, short_id: shortId })), null, 2));
	if (rows.length === 0) return console.log(all.length ? "Ninguna sesión coincide con el filtro." : `No hay sesiones en ${tilde(sessionsDir())}.`);

	const color = process.stdout.isTTY && !process.env.NO_COLOR;
	const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
	const statusColor: Record<string, string> = { working: "33", blocked: "31", idle: "32", done: "32" };

	const table = rows.map((r) => [
		fmtDate(r.mtime),
		tilde(r.cwd) + (r.exists ? "" : " (no existe)"),
		r.name || "-",
		String(r.msgs),
		r.cost > 0 ? `$${r.cost.toFixed(2)}` : "-",
		r.agent ? `${r.agent.name || "(sin nombre)"} ${r.agent.status} ${r.agent.pane}` : "",
		r.resume,
	]);
	const header = ["MODIFICADA", "DIRECTORIO", "NOMBRE", "MSGS", "COSTE", "EN HERDR", "RETOMAR"];
	const widths = header.map((h, i) => Math.max(h.length, ...table.map((row) => row[i].length)));
	const fmtRow = (row: string[]) => row.map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i]))).join("  ");

	console.log(paint("1", fmtRow(header)));
	table.forEach((row, i) => {
		const r = rows[i];
		let line = fmtRow(row);
		if (r.agent) line = line.replace(row[5], paint(statusColor[r.agent.status] || "36", row[5]));
		if (!r.exists) line = paint("2", line);
		console.log(line);
	});
	if (total > rows.length) console.log(paint("2", `… ${total - rows.length} más (-n 0 para verlas todas)`));
}
