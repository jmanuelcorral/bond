// `bond models`: registro global de modelos (~/.config/bond/config.toml) y su traducción a
// la configuración de cada agente.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { activeProviders, type Api, CONFIG_DIR, CONFIG_FILE, initialConfig, loadConfig, loadState, providerApis, saveState } from "./config.mts";
import { INCOMPATIBLE, readCurrent, hasComments, TARGETS } from "./agents.mts";
import { act, AGENT_DIR, bad, caution, die, dim, isDryRun, log, ok, REPO_DIR, run, STAMP, warn } from "./util.mts";

export const MODELS_HELP = `Uso: bond models <subcomando> [opciones]

Registro global de modelos en ${CONFIG_FILE}: se declaran una vez y bond genera la
configuración de cada agente que pueda usarlos.

  init              Crea config.toml (importa los proveedores del models.json de pi, si hay)
  list              Proveedores, modelos y qué agentes pueden usarlos
  probe [id...]     Pregunta a cada pasarela qué APIs sirve (chat, responses, messages)
  sync [opciones]   Escribe la configuración de modelos de cada agente
      --agent <a>   Solo ese agente (repetible): pi, opencode, crush, codex
      --dry-run     Enseña los cambios sin escribir
      --check       No escribe; sale con 1 si algún agente está desfasado
  path              Ruta de config.toml

Agentes: pi, opencode y Crush usan la API de chat; Codex, la API Responses; Copilot se
lanza con \`bond run copilot\`. Claude Code y Gemini no pueden usar pasarelas compatibles
con OpenAI.`;

export async function models(args: string[]): Promise<void> {
	const [sub, ...rest] = args;
	switch (sub) {
		case "init":
			return init(rest);
		case "list":
		case undefined:
			return list();
		case "probe":
			return probe(rest);
		case "sync":
			return sync(rest);
		case "path":
			return console.log(CONFIG_FILE);
		default:
			die(`subcomando desconocido: models ${sub} (bond models --help)`, 2);
	}
}

// --- init ---------------------------------------------------------------------------------

/** models.json de pi del que importar: el del repo (el de antes de bond) o el de ~/.pi/agent. */
function legacyPiModels(): string | undefined {
	for (const f of [join(REPO_DIR, "pi", "agent", "models.json"), join(AGENT_DIR, "models.json")]) if (existsSync(f)) return f;
	return undefined;
}

export function init(args: string[] = []): void {
	if (existsSync(CONFIG_FILE) && !args.includes("--force")) {
		log(`ya existe ${CONFIG_FILE} (--force para recrearlo; se guarda copia)`);
		return;
	}
	const source = legacyPiModels();
	const text = initialConfig(source);
	if (existsSync(CONFIG_FILE)) act(`cp ${CONFIG_FILE} ${CONFIG_FILE}.bak.${STAMP}`, () => copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.bak.${STAMP}`));
	act(`escribir ${CONFIG_FILE}`, () => {
		mkdirSync(CONFIG_DIR, { recursive: true });
		writeFileSync(CONFIG_FILE, text);
	});
	log(`creado ${CONFIG_FILE}${source ? ` (importado de ${source})` : " (vacío, con un ejemplo)"}`);
	if (isDryRun()) console.log(dim(text));
}

// --- list ---------------------------------------------------------------------------------

function list(): void {
	const cfg = loadConfig();
	const state = loadState();
	if (!cfg.providers.length) return console.log(`Sin proveedores. Edita ${CONFIG_FILE} (bond models init crea uno de ejemplo).`);
	for (const p of cfg.providers) {
		const apis = providerApis(p, state);
		const probed = state.probes[p.id];
		const off = p.enabled === false ? caution(" (desactivado)") : "";
		console.log(`\n${p.id}${off}  ${dim(p.base_url)}`);
		console.log(dim(`  APIs: ${apis.join(", ")}${p.apis ? " (declaradas)" : probed ? ` (probe ${probed.at.slice(0, 16).replace("T", " ")})` : " (supuesto: bond models probe)"}`));
		for (const m of p.models) {
			const served = probed ? (probed.served.includes(m.id) ? "" : caution("  no lo sirve la pasarela")) : "";
			const limits = [m.context && `ctx ${m.context}`, m.max_output && `out ${m.max_output}`].filter(Boolean).join(", ");
			console.log(`  ${m.enabled === false ? dim(`· ${m.id} (desactivado)`) : `• ${m.id}`}  ${dim(limits)}${served}`);
		}
		const agents = [
			...TARGETS.map((t) => [t.agent, apis.includes(t.needs) ? ok("✓") : bad("✗")] as const),
			["copilot", apis.includes("chat") || apis.includes("responses") ? ok("✓") : bad("✗")] as const,
			...Object.keys(INCOMPATIBLE).map((a) => [a, apis.includes("messages") && a === "claude" ? ok("✓") : bad("✗")] as const),
		];
		console.log(`  agentes: ${agents.map(([a, m]) => `${m} ${a}`).join("  ")}`);
	}
}

// --- probe --------------------------------------------------------------------------------

async function post(url: string, body: unknown, headers: Record<string, string>): Promise<boolean> {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000), // la primera petición puede cargar el modelo en RAM
		});
		await res.text();
		return res.ok;
	} catch {
		return false;
	}
}

async function probe(ids: string[]): Promise<void> {
	const cfg = loadConfig();
	const state = loadState();
	const targets = cfg.providers.filter((p) => !ids.length || ids.includes(p.id));
	if (!targets.length) die(`ningún proveedor coincide: ${ids.join(", ")}`);
	for (const p of targets) {
		const base = p.base_url.replace(/\/$/, "");
		const key = p.api_key_env ? process.env[p.api_key_env] : undefined;
		if (p.api_key_env && !key) warn(`${p.id}: la variable ${p.api_key_env} no está definida`);
		const auth: Record<string, string> = key ? { authorization: `Bearer ${key}`, "x-api-key": key } : {};
		log(`${p.id}: ${base}`);
		let served: string[] = [];
		try {
			const res = await fetch(`${base}/models`, { headers: auth, signal: AbortSignal.timeout(15_000) });
			served = (((await res.json()) as { data?: Array<{ id: string }> }).data ?? []).map((m) => m.id);
		} catch (e) {
			warn(`${p.id}: GET /models falló (${(e as Error).message})`);
		}
		const model = p.models.find((m) => m.enabled !== false)?.id;
		if (!model) {
			warn(`${p.id}: sin modelos activos que probar`);
			continue;
		}
		// Una detrás de otra: las pasarelas locales no suelen atender varias a la vez (429).
		const checks: Array<[Api, () => Promise<boolean>]> = [
			["chat", () => post(`${base}/chat/completions`, { model, messages: [{ role: "user", content: "ok" }], max_tokens: 8 }, auth)],
			["responses", () => post(`${base}/responses`, { model, input: "ok", max_output_tokens: 16 }, auth)],
			["messages", () => post(`${base}/messages`, { model, max_tokens: 8, messages: [{ role: "user", content: "ok" }] }, { ...auth, "anthropic-version": "2023-06-01" })],
		];
		const apis: Api[] = [];
		for (const [api, check] of checks) {
			const good = await check();
			if (good) apis.push(api);
			console.log(`  ${good ? ok("✓") : bad("✗")} ${api}`);
		}
		const declared = p.models.filter((m) => m.enabled !== false).map((m) => m.id);
		const missing = declared.filter((m) => served.length && !served.includes(m));
		console.log(`  ${missing.length ? caution("!") : ok("✓")} modelos: ${served.length ? `sirve ${served.length}` : "lista no disponible"}${missing.length ? `; no sirve ${missing.join(", ")}` : ""}`);
		state.probes[p.id] = { apis, served, at: new Date().toISOString() };
	}
	saveState(state);
	if (targets.some((p) => p.apis)) console.log(dim("\nNota: los proveedores con 'apis' en config.toml usan lo declarado, no lo detectado."));
}

// --- sync ---------------------------------------------------------------------------------

function showDiff(file: string, before: string | undefined, after: string): void {
	const dir = join(tmpdir(), `bond-${process.pid}`);
	mkdirSync(dir, { recursive: true });
	const a = join(dir, "antes");
	const b = join(dir, "despues");
	writeFileSync(a, before ?? "");
	writeFileSync(b, after);
	const d = run("diff", ["-u", "--label", `${file} (actual)`, "--label", `${file} (bond)`, a, b]);
	console.log(d.stdout || d.stderr);
	rmSync(dir, { recursive: true, force: true });
}

export interface SyncOptions {
	agents?: string[];
	check?: boolean;
	quiet?: boolean;
}

/** Sincroniza; devuelve los agentes desfasados (para --check y bond doctor). */
export function syncAgents(opts: SyncOptions = {}): string[] {
	const cfg = loadConfig();
	const state = loadState();
	const providers = activeProviders(cfg);
	const say = (s: string) => !opts.quiet && console.log(s);
	const stale: string[] = [];
	const chosen = opts.agents?.length ? TARGETS.filter((t) => opts.agents!.includes(t.agent)) : TARGETS.filter((t) => t.installed());
	if (opts.agents) for (const a of opts.agents) if (!TARGETS.some((t) => t.agent === a)) die(`agente sin generador de modelos: ${a} (pi, opencode, crush, codex)`);

	for (const t of chosen) {
		const usable = providers.filter((p) => providerApis(p, state).includes(t.needs));
		const unusable = providers.filter((p) => !usable.includes(p));
		const file = t.file();
		const current = readCurrent(file);
		const out = t.render(current, usable, state);
		const notes = [
			...unusable.map((p) => `${p.id}: la pasarela no sirve la API ${t.needs}`),
			...out.skipped.map((s) => `${s.id}: ${s.why}`),
		];
		const changed = out.text !== (current ?? "");
		const label = `${t.agent.padEnd(9)}`;
		if (!changed) {
			say(`${ok("✓")} ${label}${dim(`al día  ${file}`)}`);
		} else if (opts.check) {
			stale.push(t.agent);
			say(`${bad("✗")} ${label}desfasado  ${dim(file)}`);
		} else {
			stale.push(t.agent);
			if (current && /\.jsonc?$/.test(file) && hasComments(current)) {
				warn(`${file} tiene comentarios; al reescribirlo se pierden (queda copia .bak)`);
			}
			if (isDryRun()) {
				say(`${caution("~")} ${label}cambiaría ${file}`);
				showDiff(file, current, out.text);
			} else {
				// Copia la primera vez que bond toca el fichero.
				if (current !== undefined && !state.backedUp.includes(file)) {
					writeFileSync(`${file}.bak.${STAMP}`, current);
					state.backedUp.push(file);
				}
				mkdirSync(dirname(file), { recursive: true });
				// El models.json de pi era un symlink al repo: pasa a ser un fichero de esta máquina.
				rmSync(file, { force: true });
				writeFileSync(file, out.text);
				state.managed[t.agent] = out.managed;
				say(`${ok("✓")} ${label}actualizado  ${dim(file)}`);
			}
		}
		if (out.managed.length && changed && !opts.check) say(dim(`    ${out.managed.join(", ")}  → comprobar: ${t.verify}`));
		for (const n of notes) say(`    ${caution("!")} ${n}`);
		if (t.note && changed && !opts.check) say(dim(`    ${t.note}`));
	}
	const notInstalled = TARGETS.filter((t) => !chosen.includes(t) && !t.installed()).map((t) => t.agent);
	if (notInstalled.length && !opts.agents) say(dim(`no instalados (se omiten): ${notInstalled.join(", ")}  · forzar: --agent <a>`));
	if (!opts.check && !isDryRun()) saveState(state);
	return stale;
}

function sync(args: string[]): void {
	const agents: string[] = [];
	let check = false;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--agent") agents.push(args[++i] ?? die("--agent necesita un valor"));
		else if (args[i] === "--check") check = true;
		else if (args[i] === "--dry-run") continue;
		else die(`opción desconocida: ${args[i]} (bond models --help)`);
	}
	const stale = syncAgents({ agents: agents.length ? agents : undefined, check });
	if (check && stale.length) process.exitCode = 1;
}
