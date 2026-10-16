/**
 * Tool repo_map: mapa compacto de un repo (manifiestos y comandos, árbol con número de
 * ficheros, lenguajes, lo más tocado en git). Ejecuta catalog/skills/code-context/scripts/repo-map.
 *
 * Es una tool y no solo un script del skill porque los modelos pequeños usan mucho más una
 * tool declarada que un skill que tienen que decidir cargar.
 */

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SCRIPT = fileURLToPath(new URL("../catalog/skills/code-context/scripts/repo-map", import.meta.url));

const repoMapTool = defineTool({
	name: "repo_map",
	label: "Repo map",
	description:
		"Compact map of a repository: manifests and their commands (package.json scripts, Makefile targets...), directory tree with file counts, languages, and the files changed most in the last 100 commits. Cheap: about 40 lines.",
	promptSnippet: "repo_map: compact map of a repository (manifests, commands, tree, languages, hot files)",
	promptGuidelines: [
		"When you start working in a repository you have not mapped in this session, call repo_map before reading files or running git log by hand.",
	],
	parameters: Type.Object({
		path: Type.Optional(Type.String({ description: "Repository directory, relative to the current one (default: .)" })),
		depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 4, description: "Tree depth (default: 2)" })),
	}),

	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
		const args = [params.path ?? ".", String(params.depth ?? 2)];
		const text = await new Promise<string>((resolve, reject) => {
			execFile(SCRIPT, args, { cwd: ctx.cwd, signal, timeout: 30_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
				if (err) reject(new Error(`repo-map falló: ${(stderr || err.message).trim().slice(0, 500)}`));
				else resolve(stdout);
			});
		});
		return { content: [{ type: "text", text }], details: { path: args[0], depth: Number(args[1]) } };
	},
});

export default function (pi: ExtensionAPI) {
	pi.registerTool(repoMapTool);
}
