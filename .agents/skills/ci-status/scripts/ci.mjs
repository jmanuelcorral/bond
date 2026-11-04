#!/usr/bin/env node
// Estado de la pipeline de GitHub desde una sola llamada, en Windows, Linux y macOS.
//
// Sin dependencias: solo Node (>= 22) y `gh`. Nada de shell alrededor: se ejecutan
// los comandos con argv para que no haya problemas de comillas ni de separadores en
// Windows.
//
//   node ci.mjs                     estado de la rama actual
//   node ci.mjs --pr 64            una PR concreta
//   node ci.mjs --branch feat/x    una rama concreta
//   node ci.mjs --watch            bloquea hasta que termine
//   node ci.mjs --rerun-failed     reejecuta solo lo que fallo
//   node ci.mjs --json             salida maquina
//   node ci.mjs --log              vuelca el extracto de cada fallo
//
// Codigos de salida: 0 verde, 1 rojo, 2 pendiente/inacabado, 3 error de uso o de entorno.

import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Ejecucion de comandos: argv, nunca string de shell.
// ---------------------------------------------------------------------------
function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, {
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
		windowsHide: true,
		...opts,
	});
	if (r.error) return { ok: false, code: -1, out: "", err: String(r.error.message) };
	return {
		ok: r.status === 0,
		code: r.status ?? -1,
		out: (r.stdout ?? "").trim(),
		err: (r.stderr ?? "").trim(),
	};
}

function gh(args, opts = {}) {
	return run("gh", args, opts);
}

function die(msg, code = 3) {
	process.stderr.write(`error: ${msg}\n`);
	process.exit(code);
}

function needGh() {
	const v = run("gh", ["--version"]);
	if (!v.ok) die("`gh` no esta en el PATH. Instalar GitHub CLI: https://cli.github.com");
	const a = gh(["auth", "status"]);
	if (!a.ok) die("`gh` no tiene sesion. Ejecutar `gh auth login`.");
}

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
function parseArgs(argv) {
	const o = {
		pr: null,
		branch: null,
		watch: false,
		rerunFailed: false,
		json: false,
		log: false,
		timeoutSec: 1800,
		intervalSec: 20,
		dryRun: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		switch (a) {
			case "--pr": o.pr = argv[++i]; break;
			case "--branch": o.branch = argv[++i]; break;
			case "--watch": o.watch = true; break;
			case "--rerun-failed": o.rerunFailed = true; break;
			case "--dry-run": o.dryRun = true; break;
			case "--json": o.json = true; break;
			case "--log": o.log = true; break;
			case "--timeout": o.timeoutSec = Number(argv[++i]) || o.timeoutSec; break;
			case "--interval": o.intervalSec = Number(argv[++i]) || o.intervalSec; break;
			case "-h":
			case "--help":
				process.stdout.write(
					[
						"uso: node ci.mjs [--pr N | --branch RAMA] [--watch] [--rerun-failed] [--dry-run] [--json] [--log]",
						"   --timeout S   limite de --watch (por defecto 1800)",
						"   --interval S  pausa entre sondeos de --watch (por defecto 20)",
					].join("\n") + "\n",
				);
				process.exit(0);
			default:
				die(`argumento no reconocido: ${a} (probar --help)`);
		}
	}
	if (o.pr !== null && !/^\d+$/.test(o.pr)) die(`--pr tiene que ser un numero, no "${o.pr}"`);
	return o;
}

// ---------------------------------------------------------------------------
// Resolver sobre que se informa
// ---------------------------------------------------------------------------
function currentBranch() {
	const r = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (!r.ok || r.out === "HEAD") return null;
	return r.out;
}

// Devuelve { kind: "pr"|"branch", value, number?, headSha, url }
function resolveTarget(opts) {
	if (opts.pr) {
		const r = gh([
			"pr", "view", opts.pr,
			"--json", "number,headRefName,headRefOid,url,state",
		]);
		if (!r.ok) die(`no se pudo leer la PR ${opts.pr}: ${r.err}`);
		const p = JSON.parse(r.out);
		return { kind: "pr", value: p.headRefName, number: p.number, headSha: p.headRefOid, url: p.url, state: p.state };
	}
	const branch = opts.branch || currentBranch();
	if (!branch) die("rama desligada (detached HEAD) y no se indico --branch ni --pr");
	const r = gh([
		"api", `repos/{owner}/{repo}/commits/${branch}/check-runs?per_page=100`,
		"--jq", ".check_runs[0].head_sha // empty",
	]);
	if (!r.ok || !r.out) {
		// La rama puede no tener checks: se reporta como tal, no como error.
		return { kind: "branch", value: branch, headSha: null, url: null };
	}
	return { kind: "branch", value: branch, headSha: r.out, url: null };
}

// ---------------------------------------------------------------------------
// Lectura de checks
// ---------------------------------------------------------------------------
function fetchChecks(target) {
	if (!target.headSha) return [];
	const r = gh([
		"api",
		`repos/{owner}/{repo}/commits/${target.headSha}/check-runs?per_page=100&filter=latest`,
		"--jq",
		[
			".check_runs | map({",
			"  name,",
			"  status,",
			"  conclusion,",
			"  html_url,",
			"  job_id: .id,",
			"  title: (.output.title // \"\"),",
			"  started: (.started_at // \"\"),",
			"  completed: (.completed_at // \"\")",
			"}) | tojson",
		].join(""),
	]);
	if (!r.ok) die(`no se pudieron leer los checks: ${r.err}`);
	return JSON.parse(r.out);
}

// ---------------------------------------------------------------------------
// Clasificacion: codigo vs infraestructura
//
// Un `cancelled` por que el runner se cayo o se agoto el tiempo de GitHub no es un
// fallo de codigo, y tratarlo como tal hace perder la tarde. Se clasifica con las
// senales que expone la API y, si hace falta, se mira el log.
// ---------------------------------------------------------------------------
const INFRA_CONCLUSIONS = new Set(["cancelled", "timed_out", "startup_failure", "stale"]);

const INFRA_PATTERNS = [
	/the runner has stopped responding/i,
	/the job was cancelled because the runner/i,
	/A job step received a cancellation/i,
	/This job exceeded the maximum time limit/i,
	/Unable to resync the repository/i,
	/the network connection was lost/i,
	/Failed to connect to .*github/i,
	/exit code 137/i, // OOM del runner
	/repository rule or deploy key/i,
	/secondary rate limit/i,
];

function classify(c) {
	if (c.conclusion === "success") return "green";
	if (c.status !== "completed") return "pending";
	if (c.conclusion === null) return "pending";
	if (INFRA_CONCLUSIONS.has(c.conclusion)) return "infra";
	if (c.conclusion === "action_required") return "human";
	if (c.conclusion === "skipped" || c.conclusion === "neutral") return "skipped";
	return "code"; // failure: se refina con el log si hace falta
}

// Refino mirando el log de los que quedaron como "code".
function refineWithLog(c) {
	const r = gh(["run", "view", "--job", String(c.job_id), "--log-failed"]);
	const blob = (r.ok ? r.out : "") + " " + (c.title || "");
	for (const p of INFRA_PATTERNS) {
		if (p.test(blob)) return { ...c, why: `infra: ${p.source}` };
	}
	return { ...c, why: "fallo del trabajo (ver log)" };
}

// ---------------------------------------------------------------------------
// Agregacion
// ---------------------------------------------------------------------------
function aggregate(checks) {
	const g = { green: 0, code: 0, infra: 0, pending: 0, skipped: 0, human: 0 };
	const items = checks.map((c) => {
		const kind = classify(c);
		g[kind]++;
		return { ...c, kind };
	});
	let verdict;
	if (g.code > 0) verdict = "red";
	else if (g.infra > 0) verdict = "infra";
	else if (g.human > 0) verdict = "human";
	else if (g.pending > 0) verdict = "pending";
	else if (g.green > 0) verdict = "green";
	else verdict = "none";
	return { verdict, counts: g, items };
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
const ICON = {
	green: "ok  ",
	red: "FAIL",
	code: "FAIL",
	infra: "INFRA",
	pending: "... ",
	skipped: "--  ",
	human: "NEED",
	none: "    ",
};

// El log de GitHub viene con prefijo "job\tstep\t<ts>Z" en cada linea. Es util para
// localizar pero tapa lo que importa: se quita el prefijo y la marca de tiempo.
function cleanLogLine(line) {
	const parts = line.split("\t");
	let s = parts.length >= 3 ? parts.slice(2).join(" ") : line;
	s = s.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, "");
	// Secuencias de color: `gh` puede devolverlas como byte ESC real (0x1b) o ya
	// escapadas como texto literal `^[[36;1m`. Se quitan las dos formas: si no,
	// salen literales feos en la salida.
	s = s.replace(/\u001b\[[0-9;]*m/g, "");
	s = s.replace(/\^\[\[[0-9;]*m/g, "");
	// BOM que GitHub deja al principio de algunos logs.
	s = s.replace(/^\ufeff/, "");
	return s;
}

function render(target, agg, opts) {
	const out = [];
	out.push(`${ICON[agg.verdict]} ${target.kind === "pr" ? `PR #${target.number}` : `rama ${target.value}`}`);
	const c = agg.counts;
	out.push(
		`     verde ${c.green} · codigo ${c.code} · infra ${c.infra} · pendiente ${c.pending} · saltado ${c.skipped} · requiere humano ${c.human}`,
	);
	if (target.url) out.push(`     ${target.url}`);
	for (const it of agg.items) {
		if (it.kind === "green" || it.kind === "skipped") continue;
		out.push(`  ${ICON[it.kind] ?? "???"} ${it.name}  [${it.conclusion ?? it.status}]  ${it.html_url}`);
		if (opts.log && (it.kind === "code" || it.kind === "infra")) {
			const r = gh(["run", "view", "--job", String(it.job_id), "--log-failed"]);
			const tail = (r.ok ? r.out : r.err)
				.split("\n")
				.map(cleanLogLine)
				.filter((l) => l.trim().length > 0)
				.slice(-25);
			out.push("     ┌" + "─".repeat(70));
			for (const line of tail) out.push("     │ " + line.slice(0, 200));
			out.push("     └" + "─".repeat(70));
		}
	}
	return out.join("\n");
}

function verdictCode(v) {
	return { green: 0, red: 1, infra: 1, human: 2, pending: 2, none: 2 }[v] ?? 2;
}

// ---------------------------------------------------------------------------
// Reejecutar solo lo que fallo
// ---------------------------------------------------------------------------
function rerunFailed(agg, target) {
	const failed = agg.items.filter((i) => i.kind === "code" || i.kind === "infra");
	if (failed.length === 0) {
		process.stdout.write("nada que reejecutar: no hay fallos de codigo ni de infraestructura\n");
		return false;
	}
	const args = ["run", "rerun", String(runIdOf(target))];
	// `--failed` reejecuta solo los jobs fallidos, que es justo lo que se pide.
	args.push("--failed");
	const r = gh(args);
	if (!r.ok) die(`no se pudo reejecutar: ${r.err}`);
	process.stdout.write(`reejecutados ${failed.length} job(s) fallidos: ${failed.map((f) => f.name).join(", ")}\n`);
	return true;
}

function runIdOf(target) {
	// Para reejecutar hace falta el run id, no el job id. Se saca de la PR o del SHA.
	if (target.number) {
		const r = gh([
			"api", `repos/{owner}/{repo}/commits/${target.headSha}/check-runs?per_page=100`,
			"--jq", "[.check_runs[].details_url // empty] | map(capture(\"/actions/runs/(?<id>[0-9]+)\").id) | .[0] // empty",
		]);
		if (r.ok && r.out) return r.out;
	}
	const r = gh([
		"api", `repos/{owner}/{repo}/commits/${target.headSha}/check-runs?per_page=100`,
		"--jq", "[.check_runs[].details_url // empty] | map(capture(\"/actions/runs/(?<id>[0-9]+)\").id) | .[0] // empty",
	]);
	if (!r.ok || !r.out) die("no se pudo determinar el run id para reejecutar");
	return r.out;
}

// ---------------------------------------------------------------------------
// Watch
// ---------------------------------------------------------------------------
function sleep(sec) {
	// Sin dependencias: un spawn de `sleep`/`timeout` es lo portatil entre Unix y Windows.
	const r =
		process.platform === "win32"
			? run("timeout", ["/T", String(sec), "/NOBREAK"], { stdio: "ignore" })
			: run("sleep", [String(sec)], { stdio: "ignore" });
	return r.ok;
}

// ---------------------------------------------------------------------------
function main() {
	const opts = parseArgs(process.argv.slice(2));
	needGh();

	const deadline = Date.now() + opts.timeoutSec * 1000;
	let target = resolveTarget(opts);
	let agg;

	for (;;) {
		const checks = fetchChecks(target);
		agg = aggregate(checks);
		// Refinar solo los que quedaron como "code" y son pocos: cada refino es una llamada.
		if (agg.counts.code > 0 && agg.counts.code <= 5) {
			const refined = agg.items.map((i) => (i.kind === "code" ? refineWithLog(i) : i));
			agg = aggregateRaw(refined);
		}
		if (!opts.json) process.stdout.write(render(target, agg, opts) + "\n");

		if (!opts.watch) break;
		if (agg.verdict !== "pending") break;
		if (Date.now() + opts.intervalSec * 1000 > deadline) {
			process.stdout.write(`timeout de --watch tras ${opts.timeoutSec}s: sigue pendiente\n`);
			agg = { ...agg, verdict: "pending", timedOut: true };
			break;
		}
		sleep(opts.intervalSec);
	}

	if (opts.rerunFailed) {
		if (opts.dryRun) {
			const failed = agg.items.filter((i) => i.kind === "code" || i.kind === "infra");
			process.stdout.write(
				failed.length
					? `[dry-run] se reejecutarian ${failed.length} job(s): ${failed.map((f) => f.name).join(", ")}\n`
					: "[dry-run] nada que reejecutar\n",
			);
		} else {
			const did = rerunFailed(agg, target);
			if (did) process.stdout.write("vuelve con --watch para seguir la nueva corrida\n");
		}
	}

	if (opts.json) {
		process.stdout.write(
			JSON.stringify(
				{
					target: { kind: target.kind, name: target.value, pr: target.number ?? null, sha: target.headSha, url: target.url },
					verdict: agg.verdict,
					counts: agg.counts,
					checks: agg.items.map((i) => ({
						name: i.name,
						status: i.status,
						conclusion: i.conclusion,
						kind: i.kind,
						why: i.why ?? null,
						url: i.html_url,
					})),
				},
				null,
				2,
			) + "\n",
		);
	}

	process.exit(verdictCode(agg.verdict));
}

// Reagrega una lista ya refinada sin volver a pasar por el refino.
function aggregateRaw(items) {
	const g = { green: 0, code: 0, infra: 0, pending: 0, skipped: 0, human: 0 };
	for (const it of items) g[it.kind]++;
	let verdict;
	if (g.code > 0) verdict = "red";
	else if (g.infra > 0) verdict = "infra";
	else if (g.human > 0) verdict = "human";
	else if (g.pending > 0) verdict = "pending";
	else if (g.green > 0) verdict = "green";
	else verdict = "none";
	return { verdict, counts: g, items };
}

main();
