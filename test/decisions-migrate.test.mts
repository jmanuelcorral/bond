// Pruebas de migración de accepted_via (cli/decisions-migrate.mts).
// Cada prueba trabaja en un repo git temporal en mktemp -d (nunca el HOME real).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateAcceptedVia, formatMigrateOutput } from "../cli/decisions-migrate.mts";
import { parseFm } from "../cli/decisions.mts";

process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-test-"));
const origCwd = process.cwd();
let repo: string;

beforeEach(() => {
	repo = realpathSync(mkdtempSync(join(tmpdir(), "bond-dec-migrate-")));
	spawnSync("git", ["init", "-q"], { cwd: repo });
	process.chdir(repo);
});

afterEach(() => {
	process.chdir(origCwd);
	rmSync(repo, { recursive: true, force: true });
});

const at = (p: string) => join(repo, p);
const read = (p: string) => readFileSync(at(p), "utf8");
const write = (p: string, s: string) => {
	mkdirSync(join(at(p), ".."), { recursive: true });
	writeFileSync(at(p), s, "utf8");
};

describe("migrateAcceptedVia", () => {
	test("migra un accepted_via: 'agent:pi/gru' a 'user'", () => {
		const original = `---
id: "2026-11-01-ejemplo"
title: "Ejemplo de decision"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:pi/gru"
accepted_by: "aprobado por el usuario"
accepted_via: "agent:pi/gru"
supersedes: ""
superseded_by: ""
links: []
---

## Context

Contexto de la decision.
`;
		write("docs/decisions/2026-11-01-ejemplo.md", original);

		const res = migrateAcceptedVia(repo, "docs/decisions");
		expect(res.migratedCount).toBe(1);
		expect(res.migrated.length).toBe(1);
		expect(res.migrated[0].file).toBe("docs/decisions/2026-11-01-ejemplo.md");
		expect(res.migrated[0].from).toBe("agent:pi/gru");
		expect(res.migrated[0].to).toBe("user");

		const updated = read("docs/decisions/2026-11-01-ejemplo.md");
		const p = parseFm(updated);
		expect(p).toBeDefined();
		expect(p!.scalars.status).toBe("accepted");
		expect(p!.scalars.accepted_via).toBe("user");
		expect(p!.scalars.decided_by).toBe("agent:pi/gru");
	});

	test("idempotencia (segunda pasada: 0 cambios)", () => {
		const original = `---
id: "2026-11-01-idempotente"
title: "Idempotencia"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:claude"
accepted_by: "ok"
accepted_via: "agent:claude"
supersedes: ""
superseded_by: ""
links: []
---

## Context
Texto.
`;
		write("docs/decisions/2026-11-01-idempotente.md", original);

		// Primera pasada: migra
		const r1 = migrateAcceptedVia(repo, "docs/decisions");
		expect(r1.migratedCount).toBe(1);
		const contentAfterR1 = read("docs/decisions/2026-11-01-idempotente.md");

		// Segunda pasada: 0 cambios
		const r2 = migrateAcceptedVia(repo, "docs/decisions");
		expect(r2.migratedCount).toBe(0);
		expect(r2.alreadyUserCount).toBe(1);
		const contentAfterR2 = read("docs/decisions/2026-11-01-idempotente.md");
		expect(contentAfterR2).toBe(contentAfterR1);
	});

	test("deja intacto un accepted_via: '' y uno que ya sea 'user'", () => {
		const emptyVia = `---
id: "2026-11-01-terminal"
title: "Aceptada en terminal"
status: "accepted"
date: "2026-11-01"
decided_by: "user"
accepted_by: "interactivo"
accepted_via: ""
supersedes: ""
superseded_by: ""
links: []
---

## Context
Terminal.
`;
		const userVia = `---
id: "2026-11-01-ya-user"
title: "Ya es user"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:pi"
accepted_by: "confirmado"
accepted_via: "user"
supersedes: ""
superseded_by: ""
links: []
---

## Context
Ya en user.
`;
		write("docs/decisions/2026-11-01-terminal.md", emptyVia);
		write("docs/decisions/2026-11-01-ya-user.md", userVia);

		const res = migrateAcceptedVia(repo, "docs/decisions");
		expect(res.migratedCount).toBe(0);
		expect(res.emptyCount).toBe(1);
		expect(res.alreadyUserCount).toBe(1);

		expect(read("docs/decisions/2026-11-01-terminal.md")).toBe(emptyVia);
		expect(read("docs/decisions/2026-11-01-ya-user.md")).toBe(userVia);
	});

	test("--dry-run no escribe (compara el contenido del fichero antes y después)", () => {
		const original = `---
id: "2026-11-01-dry"
title: "Dry run test"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:pi/kevin"
accepted_by: "el usuario"
accepted_via: "agent:pi/kevin"
supersedes: ""
superseded_by: ""
links: []
---

## Context
Prueba dry run.
`;
		write("docs/decisions/2026-11-01-dry.md", original);

		const res = migrateAcceptedVia(repo, "docs/decisions", { dryRun: true });
		expect(res.dryRun).toBe(true);
		expect(res.migratedCount).toBe(1);
		expect(res.migrated[0].from).toBe("agent:pi/kevin");
		expect(res.migrated[0].to).toBe("user");

		const after = read("docs/decisions/2026-11-01-dry.md");
		expect(after).toBe(original);
	});

	test("no toca decisiones proposed / rejected / superseded", () => {
		const proposed = `---
id: "2026-11-01-prop"
title: "Propuesta"
status: "proposed"
date: "2026-11-01"
decided_by: "agent:pi"
accepted_by: ""
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links: []
---
`;
		const rejected = `---
id: "2026-11-01-rej"
title: "Rechazada"
status: "rejected"
date: "2026-11-01"
decided_by: "agent:pi"
accepted_by: ""
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links: []
---
`;
		const superseded = `---
id: "2026-11-01-sup"
title: "Sustituida"
status: "superseded"
date: "2026-11-01"
decided_by: "agent:pi"
accepted_by: "antigua cita"
accepted_via: "agent:pi"
supersedes: ""
superseded_by: "2026-11-02-nueva"
links: []
---
`;
		write("docs/decisions/2026-11-01-prop.md", proposed);
		write("docs/decisions/2026-11-01-rej.md", rejected);
		write("docs/decisions/2026-11-01-sup.md", superseded);

		const res = migrateAcceptedVia(repo, "docs/decisions");
		expect(res.migratedCount).toBe(0);
		expect(res.skippedCount).toBe(3);

		expect(read("docs/decisions/2026-11-01-prop.md")).toBe(proposed);
		expect(read("docs/decisions/2026-11-01-rej.md")).toBe(rejected);
		expect(read("docs/decisions/2026-11-01-sup.md")).toBe(superseded);
	});

	test("conserva el cuerpo y los demás campos del frontmatter byte a byte salvo accepted_via", () => {
		const original = `---
id: "2026-11-01-byte-a-byte"
title: "Preservacion exacta"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:pi/gru"
accepted_by: "«aprobado en sesion»"
accepted_via: "agent:pi/gru"
supersedes: "2026-10-20-antigua"
superseded_by: ""
links:
  - "commit: abc1234"
  - "branch: feature/test"
---


## Context

Parrafo con saltos de linea especiales, comillas "dobles" y 'simples'.
Caracteres: ¡hola! ¿que tal? á é í ó ú ñ.

## Decision

Segunda seccion intacta con codigo:
\`\`\`ts
const x = 42;
\`\`\`
`;
		write("docs/decisions/2026-11-01-byte-a-byte.md", original);

		const expected = original.replace(
			'accepted_via: "agent:pi/gru"',
			'accepted_via: "user"',
		);

		migrateAcceptedVia(repo, "docs/decisions");

		const actual = read("docs/decisions/2026-11-01-byte-a-byte.md");
		expect(actual).toBe(expected);
	});

	test("formato del informe incluye la nota explicativa sobre accepted_by", () => {
		const original = `---
id: "2026-11-01-inf"
title: "Informe"
status: "accepted"
date: "2026-11-01"
decided_by: "agent:pi"
accepted_by: "ok"
accepted_via: "agent:pi"
supersedes: ""
superseded_by: ""
links: []
---
`;
		write("docs/decisions/2026-11-01-inf.md", original);

		const res = migrateAcceptedVia(repo, "docs/decisions", { dryRun: true });
		const out = formatMigrateOutput(res, "docs/decisions");
		expect(out).toContain("dry-run");
		expect(out).toContain("accepted_by");
		expect(out).toContain("user");
	});
});
