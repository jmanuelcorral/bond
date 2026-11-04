#!/usr/bin/env node
// Fusionar una PR con rebase y borrar sus ramas, sin perder nada por el camino.
//
//   node merge.mjs 64                fusionar la PR 64 y borrar sus ramas
//   node merge.mjs 64 --dry-run      decir que se haria, sin tocar nada
//   node merge.mjs 64 --no-delete    fusionar y dejar las ramas
//   node merge.mjs --delete-only 64  no fusionar, solo borrar (PR ya fusionada)
//   node merge.mjs --clean           podar ramas locales ya fusionadas y sus remotas
//
// Codigos de salida: 0 hecho, 1 rechazo o fallo, 3 error de uso o de entorno.

import { spawnSync } from "node:child_process";

const MAINS = new Set(["main", "master"]);

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
const gh = (a, o = {}) => run("gh", a, o);
const git = (a, o = {}) => run("git", a, o);

function die(msg, code = 3) {
	process.stderr.write(`error: ${msg}\n`);
	process.exit(code);
}

function needEnv() {
	if (!run("gh", ["--version"]).ok) die("`gh` no esta en el PATH");
	if (!gh(["auth", "status"]).ok) die("`gh` sin sesion: ejecutar `gh auth login`");
	if (!git(["rev-parse", "--git-dir"]).ok) die("esto no es un repo git");
}

// ---------------------------------------------------------------------------
// Verificacion de integracion
//
// Despues de un rebase los SHA de la rama ya no estan en main, asi que
//   git log main..rama   -> dice que hay commits pendientes (FALSO ALARMA)
//   git diff main..rama  -> muestra la rama como "por detras" (FALSO ALARMA)
// La prueba correcta es por equivalencia de parches, no por SHA.
// ---------------------------------------------------------------------------
function unappliedPatches(base, branch) {
	const r = git(["cherry", "-v", base, branch]);
	if (!r.ok) return null;
	return r.out
		.split("\n")
		.filter((l) => l.startsWith("+"))
		.map((l) => l.slice(1).trim())
		.filter(Boolean);
}

function localExists(branch) {
	return git(["rev-parse", "--verify", `refs/heads/${branch}`]).ok;
}
function remoteExists(branch) {
	return git(["rev-parse", "--verify", `refs/remotes/origin/${branch}`]).ok;
}

// Que worktree tiene la rama montada. Si lo esta, `git branch -D` se niega y hay
// que avisar en vez de desmontar a lo bruto: puede haber un agente trabajando ahi.
function worktreeHolding(branch) {
	const r = git(["worktree", "list", "--porcelain"]);
	if (!r.ok) return null;
	let cur = null;
	for (const line of r.out.split("\n")) {
		if (line.startsWith("worktree ")) cur = line.slice(9).trim();
		if (line === `branch refs/heads/${branch}`) return cur;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Borrar una rama, local y remota, con las comprobaciones puestas
// ---------------------------------------------------------------------------
function deleteBranch(branch, base, dryRun, log) {
	const local = localExists(branch);
	const remote = remoteExists(branch);
	if (!local && !remote) {
		log(`  ramas de "${branch}" ya no existen: nada que borrar`);
		return { deleted: [], skipped: [] };
	}

	// 1. Nada sin integrar. Si hay un parche que no esta en la base, NO se borra.
	const pend = unappliedPatches(base, branch);
	if (pend === null) {
		log(`  RECHAZADO: no se pudo verificar la integracion de "${branch}" (git cherry fallo)`);
		return { deleted: [], skipped: [branch] };
	}
	if (pend.length > 0) {
		log(`  RECHAZADO: ${pend.length} parche(s) de "${branch}" no estan en "${base}":`);
		for (const p of pend.slice(0, 10)) log(`      ${p.slice(0, 110)}`);
		return { deleted: [], skipped: [branch] };
	}

	// 2. Nunca borrar la base ni la rama en la que se esta.
	const here = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
	if (MAINS.has(branch) || branch === here) {
		log(`  RECHAZADO: "${branch}" es rama principal o la rama actual`);
		return { deleted: [], skipped: [branch] };
	}

	// 3. Worktrees que la retienen.
	const wt = worktreeHolding(branch);
	if (wt) {
		log(`  RETENIDA: "${branch}" esta montada en el worktree ${wt}`);
		log(`      desmontarlo es decision tuya: git worktree remove "${wt}"`);
		return { deleted: [], skipped: [branch] };
	}

	const deleted = [];
	if (dryRun) {
		if (local) deleted.push(`local:${branch}`);
		if (remote) deleted.push(`origin/${branch}`);
		log(`  [dry-run] borrar${local ? " local" : ""}${remote ? " origin/" + branch : ""}: ${branch}`);
		return { deleted, skipped: [] };
	}

	if (local) {
		const r = git(["branch", "-D", branch]);
		if (r.ok) deleted.push(`local:${branch}`);
		else {
			log(`  no se pudo borrar la local: ${r.err}`);
			return { deleted, skipped: [branch] };
		}
	}
	if (remote) {
		const r = git(["push", "origin", "--delete", branch]);
		if (r.ok) deleted.push(`origin/${branch}`);
		else log(`  no se pudo borrar la remota: ${r.err}`);
	}
	log(`  borrado: ${deleted.join(", ")}`);
	return { deleted, skipped: [] };
}

// Despues de fusionar la PR propia seguimos encima de su rama, y `git branch -D`
// no borra la rama en la que estas. La guarda esta bien, pero el flujo queda roto
// si no se sale antes. Solo se sale si el arbol esta limpio: con cambios sin
// commitear, cambiarse de rama es decision del usuario, no de un script.
function leaveBranch(branch, base, dryRun, log) {
	const here = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
	if (here !== branch) return true;
	if (dryRun) {
		log(`  [dry-run] git checkout ${base} (estas encima de "${branch}")`);
		return true;
	}
	const dirty = git(["status", "--porcelain"]);
	if (!dirty.ok) {
		log(`  RECHAZADO: no se pudo comprobar el estado del arbol de trabajo`);
		return false;
	}
	if (dirty.out) {
		log(`  RECHAZADO: estas encima de "${branch}" y hay cambios sin commitear:`);
		for (const l of dirty.out.split("\n").slice(0, 8)) log(`      ${l}`);
		log(`      guarda o commitea antes de borrar la rama`);
		return false;
	}
	// Traer la base y cambiarse a ella creando el branch local si no existe.
	const co = git(["checkout", base]);
	if (!co.ok) {
		log(`  no se pudo cambiar a "${base}": ${co.err}`);
		return false;
	}
	log(`  salido de "${branch}" a "${base}"`);
	return true;
}

// ---------------------------------------------------------------------------
// Fusionar
// ---------------------------------------------------------------------------
function readPr(n) {
	const r = gh(["pr", "view", String(n), "--json", "number,state,headRefName,baseRefName,headRefOid,url,isDraft"]);
	if (!r.ok) die(`no se pudo leer la PR ${n}: ${r.err}`);
	return JSON.parse(r.out);
}

function mergeRebase(n, dryRun, log) {
	if (dryRun) {
		log(`  [dry-run] gh pr merge ${n} --rebase`);
		return true;
	}
	const r = gh(["pr", "merge", String(n), "--rebase"]);
	if (!r.ok) {
		log(`  fallo al fusionar: ${r.err || r.out}`);
		return false;
	}
	log(`  fusionada con rebase`);
	return true;
}

// ---------------------------------------------------------------------------
// --clean: podar ramas locales ya fusionadas
// ---------------------------------------------------------------------------
function cleanMerged(base, dryRun, log) {
	const r = git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
	if (!r.ok) die("no se pudieron listar las ramas locales");
	const branches = r.out.split("\n").filter((b) => b && !MAINS.has(b) && b !== git(["rev-parse", "--abbrev-ref", "HEAD"]).out);
	if (branches.length === 0) {
		log("sin ramas locales que podar");
		return;
	}
	let del = 0;
	let skip = 0;
	for (const b of branches) {
		log(`- ${b}`);
		const res = deleteBranch(b, base, dryRun, log);
		del += res.deleted.length;
		skip += res.skipped.length;
	}
	log(`\npoda: ${del} borrado(s), ${skip} conservado(s)`);
}

// ---------------------------------------------------------------------------
function main() {
	const argv = process.argv.slice(2);
	const dryRun = argv.includes("--dry-run");
	const noDelete = argv.includes("--no-delete");
	const deleteOnly = argv.includes("--delete-only");
	const clean = argv.includes("--clean");
	const nums = argv.filter((a) => /^\d+$/.test(a)).map(Number);

	const log = (...a) => process.stdout.write(a.join(" ") + "\n");

	needEnv();

	if (clean) {
		log(dryRun ? "PODA (dry-run, no se toca nada)\n" : "PODA\n");
		cleanMerged("main", dryRun, log);
		if (!dryRun) {
			git(["fetch", "--prune"]);
			log("fetch --prune hecho");
		}
		return;
	}

	if (nums.length !== 1) die("falta el numero de PR (o usar --clean). Probar: node merge.mjs 64");
	const n = nums[0];
	const pr = readPr(n);
	const base = pr.baseRefName || "main";

	log(`${dryRun ? "[dry-run] " : ""}PR #${n}  ${pr.headRefName} -> ${base}  [${pr.state}]`);
	log(`  ${pr.url}`);

	if (pr.state === "MERGED") {
		log("  ya estaba fusionada");
	} else if (pr.state === "CLOSED") {
		die(`la PR #${n} esta cerrada sin fusionar: no se borra nada`, 1);
	} else if (pr.isDraft) {
		die(`la PR #${n} es draft: no se fusiona`, 1);
	} else if (!deleteOnly) {
		if (!mergeRebase(n, dryRun, log)) die("no se pudo fusionar", 1);
	}

	if (noDelete) {
		log("  --no-delete: las ramas se quedan como estan");
		return;
	}

	// Tras fusionar hay que traer la base para que la verificacion sea contra lo que hay.
	if (!dryRun) {
		git(["fetch", "origin", base]);
	}
	const verifyBase = dryRun ? base : `origin/${base}`;

	log("\n  verificacion de integracion (git cherry, por equivalencia de parches):");
	if (!leaveBranch(pr.headRefName, base, dryRun, log)) {
		log("\n  no se ha borrado nada. Resolver lo de arriba y repetir con --delete-only.");
		process.exit(1);
	}
	const res = deleteBranch(pr.headRefName, verifyBase, dryRun, log);
	if (res.skipped.length > 0) {
		log(`\n  ${res.skipped.length} rama(s) NO borrada(s). Revisar arriba antes de insistir.`);
		process.exit(1);
	}
	if (!dryRun) {
		git(["fetch", "--prune"]);
		log("  fetch --prune hecho");
	}
	log(dryRun ? "\n[dry-run] nada tocado" : "\nhecho");
}

main();
