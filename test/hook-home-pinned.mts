// Las pruebas nunca tocan el home real del usuario: los hooks de presupuesto (que se
// instalan en ~/.codex, ~/.claude...) van a un home temporal. Cada preload deja ganar
// a lo que ya venga puesto fuera.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.BOND_HOOK_HOME) process.env.BOND_HOOK_HOME = mkdtempSync(join(tmpdir(), "bond-hook-home-"));
