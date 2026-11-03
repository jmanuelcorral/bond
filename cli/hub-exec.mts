// bond hub exec: ejecuta un comando en el hub y en cada repo de la sesión, en ese orden y de
// forma secuencial (issue #46). Puede ser destructivo: pide una unica confirmacion que lista los
// repos afectados y el comando exacto (saltable con --yes); con --dry-run no pregunta porque no
// ejecuta nada.
//
// Decisiones aplicadas (aprobadas por el usuario en la conversacion del #46):
// 1. `--` obligatorio: todo lo que va despues es el comando y sus argumentos; bond no lo
//    interpreta. Sin `--`, error claro con la forma correcta.
// 2. argv directo por defecto; `--shell` opt-in. Sin shell el comando se ejecuta tal cual,
//    sin pipes, `&&` ni globs. Es la UNICA excepcion con shell en todo bond (en Windows el
//    shell es cmd.exe, con semantica distinta, y propagar shell por defecto a N repos es un
//    riesgo). Ver shellInvocation(): el unico spawnSync con semantica de shell del repo.
// 3. Si un repo falla no se corta el resto; el exit code final es el peor (el maximo) de
//    los devueltos, para que `bond hub exec -- npm test` sirva en scripts.
// 4. Una sola confirmacion antes de ejecutar (ver la capa CLI de abajo).
// 5. Secuencial, repo a repo, con cabecera por repo (no se entrelaza la salida).
// 6. stdin: el hijo se ejecuta con stdin en /dev/null (NUL en Windows): si intenta leer,
//    recibe EOF al instante y termina; nunca puede quedar colgado esperando un terminal.

import { spawnSync } from "node:child_process";
import { dieNotAHub, hubRepoLabel, hubRoot, hubSession, type HubSession } from "./hub.mts";
import { bad, die, dim, isDryRun, log, ok, setDryRun } from "./util.mts";
import { t } from "./messages.mts";

export const hubExecHelp = (): string => t("hub.exec.help");

export type ExecStatus = "executed" | "would_run" | "skipped_not_present";

export interface ExecRepoResult {
	repo: string;
	path: string;
	cwd: string;
	status: ExecStatus;
	exitCode?: number;
	stdout?: string;
	stderr?: string;
}

export interface HubExecReport {
	hub: string;
	root: string;
	shell: boolean;
	/** El comando tal como lo dio el usuario (argv). En modo shell, los tokens se unen con espacios. */
	command: string[];
	confirmed: boolean;
	cancelled?: boolean;
	dryRun?: boolean;
	/** El peor (maximo) exit code de los repos; 130 si se cancelo la confirmacion. */
	exitCode: number;
	repos: ExecRepoResult[];
}

/**
 * La invocacion con shell del comando: cmd.exe en Windows, /bin/sh en el resto. ES LA UNICA
 * excepcion de "bond nunca usa shell" del repo, y solo se alcanza con `--shell` explicito.
 */
const shellInvocation = (cmd: string[]): { exe: string; args: string[] } =>
	process.platform === "win32"
		? { exe: "cmd.exe", args: ["/d", "/s", "/c", cmd.join(" ")] }
		: { exe: "/bin/sh", args: ["-c", cmd.join(" ")] };

/**
 * Ejecuta el comando en un cwd. stdin en "ignore": el hijo herde /dev/null (NUL en Windows),
 * de modo que cualquier lectura de stdin devuelve EOF al instante y el proceso no puede
 * colgarse aunque intente leer (requisito 6). Sin timeout: el comando del usuario dura lo que
 * dura; el que no se cuelga lo garantiza el stdin cerrado, no un reloj.
 */
function runOne(cwd: string, cmd: string[], shell: boolean): { exitCode: number; stdout: string; stderr: string } {
	const inv = shell ? shellInvocation(cmd) : { exe: cmd[0], args: cmd.slice(1) };
	const r = spawnSync(inv.exe, inv.args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (r.error) return { exitCode: 127, stdout: r.stdout ?? "", stderr: String(r.error.message) };
	return { exitCode: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * El nucleo del comando, sin CLI ni preguntas: recorre la sesion (el hub primero) en orden y
 * ejecuta. `confirm`, si se pasa, se consulta una sola vez antes de tocar nada; si devuelve
 * false no se ejecuta nada y el informe sale cancelado con 130.
 */
export async function hubExecRun(
	s: HubSession,
	cmd: string[],
	opts: { shell?: boolean; dryRun?: boolean; confirm?: () => Promise<boolean> } = {},
): Promise<HubExecReport> {
	const shell = opts.shell ?? false;
	const dryRun = opts.dryRun ?? isDryRun();
	const base = { hub: s.name, root: s.root, shell, command: cmd, ...(dryRun ? { dryRun: true } : {}) };

	if (dryRun) {
		return {
			...base,
			confirmed: false,
			exitCode: 0,
			repos: s.repos.map((r) => ({
				repo: hubRepoLabel(s, r),
				path: r.path,
				cwd: r.dir,
				status: r.present ? ("would_run" as ExecStatus) : ("skipped_not_present" as ExecStatus),
			})),
		};
	}

	// Sin `confirm` pasado es porque ya hay autorizacion (--yes o --dry-run handled arriba).
	let confirmed = true;
	if (opts.confirm) {
		confirmed = await opts.confirm();
		if (!confirmed) {
			return { ...base, confirmed: false, cancelled: true, exitCode: 130, repos: [] };
		}
	}

	const results: ExecRepoResult[] = [];
	for (const r of s.repos) {
		if (!r.present) {
			results.push({ repo: hubRepoLabel(s, r), path: r.path, cwd: r.dir, status: "skipped_not_present" });
			continue;
		}
		const out = runOne(r.dir, cmd, shell);
		results.push({ repo: hubRepoLabel(s, r), path: r.path, cwd: r.dir, status: "executed", ...out });
	}
	const worst = results.reduce((w, rp) => Math.max(w, rp.exitCode ?? 0), 0);
	return { ...base, confirmed, exitCode: worst, repos: results };
}

/** El comando como se muestra: argv unido con espacios (en modo shell, la cadena que recibe el shell). */
const displayCmd = (cmd: string[]) => cmd.join(" ");

export function hubExecJson(r: HubExecReport): string {
	return JSON.stringify(r, null, 2);
}

export function printExec(r: HubExecReport): void {
	if (r.cancelled) {
		log(t("hub.cancelled"));
		return;
	}
	if (r.dryRun) {
		log(`hub ${r.hub} ${dim(`(${r.root})`)}`);
		for (const rp of r.repos) {
			const label = `${rp.repo} ${dim(`(${rp.cwd})`)}`;
			if (rp.status === "skipped_not_present") console.log(`  ${dim("-")} ${label}  ${dim(t("hub.exec_not_present"))}`);
			else console.log(`  ${dim("[dry-run]")} ${label}  ${displayCmd(r.command)}`);
		}
		console.log(dim(t("hub.exec_dry_run_note")));
		return;
	}
	for (const rp of r.repos) {
		const label = `${rp.repo} ${dim(`(${rp.cwd})`)}`;
		if (rp.status === "skipped_not_present") {
			console.log(`  ${dim("-")} ${label}  ${dim(t("hub.exec_not_present"))}`);
			continue;
		}
		console.log(`${dim("──")} ${label} ${dim("──")}`);
		if (rp.stdout) process.stdout.write(rp.stdout.endsWith("\n") ? rp.stdout : `${rp.stdout}\n`);
		if (rp.stderr) process.stderr.write(rp.stderr.endsWith("\n") ? rp.stderr : `${rp.stderr}\n`);
		console.log(rp.exitCode === 0 ? `  ${ok(`exit ${rp.exitCode}`)}` : `  ${bad(`exit ${rp.exitCode}`)}`);
	}
	const ran = r.repos.filter((rp) => rp.status === "executed").length;
	const skipped = r.repos.filter((rp) => rp.status === "skipped_not_present").length;
	const parts = [t("hub.exec_summary_ran", { count: ran })];
	if (skipped) parts.push(t("hub.exec_summary_skipped", { count: skipped }));
	parts.push(t("hub.exec_summary_worst", { code: r.exitCode }));
	const title = r.exitCode === 0 ? ok(t("hub.exec_done")) : bad(t("hub.exec_done"));
	console.log(`${title}${dim(` · ${parts.join(" · ")}`)}`);
}

export async function hubExec(args: string[]): Promise<void> {
	// El `--` es lo que permite que el comando arbitrario no choque con la lista blanca de
	// opciones de bond: todo lo anterior son opciones, todo lo posterior es el comando.
	const sep = args.indexOf("--");
	const own = args.slice(0, sep === -1 ? args.length : sep);
	if (own.includes("-h") || own.includes("--help")) {
		console.log(hubExecHelp().trimEnd());
		return;
	}
	// La ayuda se mira antes del `--` para que `bond hub exec --help` funcione siempre;
	// despues, sin separador no hay comando: decirlo manda sobre todo lo demas.
	if (sep === -1) die(t("hub.exec_needs_dashdash"));
	const cmd = args.slice(sep + 1);
	if (cmd.length === 0) die(t("hub.exec_empty_command"));
	const dryRun = own.includes("--dry-run");
	const json = own.includes("--json");
	const yes = own.includes("--yes") || own.includes("-y");
	const shell = own.includes("--shell");
	for (const a of own) {
		if (!["--dry-run", "--json", "--yes", "-y", "--shell"].includes(a)) die(t("hub.exec_unknown_opt", { opt: a }));
	}
	if (dryRun) setDryRun(true);

	const root = hubRoot(process.cwd());
	if (!root) dieNotAHub();
	const s = hubSession(root);
	if (!s) die(t("hub.dir_not_a_hub", { name: root }));

	// Una sola confirmacion: comando exacto y repos afectados antes de tocar nada. Con --json
	// la pregunta va a stderr para no ensuciar el informe. Sin TTY no se puede preguntar:
	// mejor morir claro que ejecutar algo destructivo sin confirmacion.
	let confirm: (() => Promise<boolean>) | undefined;
	if (!dryRun && !yes) {
		if (process.stdin.isTTY !== true) die(t("hub.exec_unattended"));
		confirm = async () => {
			// Con --json, todo lo del prompt (tambien el de @clack, que escribe directo a
			// process.stdout) se desvia a stderr: la stdout es solo el informe.
			const origWrite = process.stdout.write.bind(process.stdout);
			if (json) process.stdout.write = ((chunk: unknown) => process.stderr.write(chunk as never)) as typeof process.stdout.write;
			try {
				const present = s.repos.filter((r) => r.present);
				console.log(t("hub.exec_confirm_header", { count: present.length }));
				console.log(`  ${shell ? `${process.platform === "win32" ? "cmd.exe /c" : "/bin/sh -c "}«${displayCmd(cmd)}»` : displayCmd(cmd)}`);
				for (const r of present) console.log(`  - ${hubRepoLabel(s, r)} ${dim(`(${r.dir})`)}`);
				const p = await import("@clack/prompts");
				const go = await p.confirm({ message: t("hub.exec_confirm_prompt"), initialValue: false });
				return go === true;
			} finally {
				if (json) process.stdout.write = origWrite;
			}
		};
	}

	const report = await hubExecRun(s, cmd, { shell, dryRun, confirm });
	if (json) console.log(hubExecJson(report));
	else printExec(report);
	process.exitCode = report.exitCode;
}
