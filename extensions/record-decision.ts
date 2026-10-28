/**
 * Tool record_decision: registra una decisión no trivial en la memoria de decisiones del
 * repo ([decisions] en .bond/bond.toml) llamando a `bond decisions add` por shell: bond
 * calcula el id, la autoría (desde el panel de Herdr) y la fila del índice. La decisión
 * entra como "proposed": solo el usuario la acepta con `bond decisions accept`.
 *
 * Es una tool y no solo una skill porque los modelos locales no siguen formatos a mano:
 * la escritura delicada la hace bond, el modelo solo pasa el contenido (D11).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Dónde está el CLI de bond: BOND_BIN, el del repo en desarrollo o el del PATH. */
function bondBin(): string {
	if (process.env.BOND_BIN) return process.env.BOND_BIN;
	const local = fileURLToPath(new URL("../bin/bond", import.meta.url));
	return existsSync(local) ? local : "bond";
}

const recordDecisionTool = defineTool({
	name: "record_decision",
	label: "Record decision",
	description:
		"Record a non-trivial decision (yours or the user's) in this repository's decision memory via `bond decisions add`. Requires the repo to enable [decisions] in .bond/bond.toml. bond writes the decision file, its id and the index row; the decision always enters as proposed and only the user can accept it. Do not use for routine details.",
	promptSnippet: "record_decision: store a non-trivial decision in the repo's decision memory (bond)",
	promptGuidelines: [
		"When a non-trivial decision is made in this session (a contract, dependency, scope or design alternative is settled) and the repo has decision memory ([decisions] in .bond/bond.toml), record it with record_decision instead of writing files under docs/decisions by hand.",
		"Never mark a decision accepted yourself: record_decision creates it as proposed; only the user accepts it.",
	],
	parameters: Type.Object({
		title: Type.String({ description: "Short, searchable title of the decision" }),
		context: Type.Optional(Type.String({ description: "What situation made this decision necessary (two or three sentences)" })),
		decision: Type.String({ description: "The decision itself, stated so it can be applied without rereading the conversation" }),
		alternatives: Type.Optional(Type.String({ description: "Alternatives considered and why they were rejected (only real ones)" })),
		links: Type.Optional(
			Type.Array(Type.String({ description: 'Reference in "kind: value" form, e.g. "plan: docs/plans/x.md#p2", "pr: https://..." , "run: runs/..."' })),
		),
	}),

	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
		const payload = JSON.stringify({
			title: params.title,
			context: params.context ?? "",
			decision: params.decision,
			alternatives: params.alternatives ?? "",
			links: params.links ?? [],
		});
		const { stdout, stderr, code } = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
			// spawn con stdin de tubería: el payload se escribe y se cierra. execFile no tiene
			// opción `input` (se ignora en silencio) y el hijo se quedaría esperando por stdin.
			const child = spawn(bondBin(), ["decisions", "add", "--stdin", "--json"], { cwd: ctx.cwd, stdio: ["pipe", "pipe", "pipe"], signal });
			let out = "";
			let errOut = "";
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGKILL");
			}, 30_000);
			child.stdout.on("data", (d) => (out += d));
			child.stderr.on("data", (d) => (errOut += d));
			child.on("error", (e) => {
				clearTimeout(timer);
				reject(e.code === "ENOENT" ? new Error("bond no está en el PATH (instálalo o pon BOND_BIN)") : e);
			});
			child.on("close", (c) => {
				clearTimeout(timer);
				if (timedOut) reject(new Error("bond decisions add superó 30 s"));
				else resolve({ stdout: out, stderr: errOut, code: c ?? 1 });
			});
			child.stdin.end(payload);
		});
		if (code !== 0) throw new Error((stderr || stdout).trim().slice(0, 500) || "bond decisions add falló");
		const res = JSON.parse(stdout) as { id: string; path: string; status: string; decided_by: string };
		return {
			content: [{ type: "text", text: `Recorded ${res.id} (${res.status}, decided by ${res.decided_by}) at ${res.path}. Only the user can accept it: bond decisions accept ${res.id}` }],
			details: res,
		};
	},
});

export default function (pi: ExtensionAPI) {
	pi.registerTool(recordDecisionTool);
}
