// Las pruebas nunca leen ni escriben el ~/.bond real: bun comparte los módulos entre ficheros
// de test, así que el primero que importa cli/runtime.mts fija BOND_HOME para todos. Si ese
// fichero no lo había puesto, era el ~/.bond del que lanza las pruebas (y su config.toml
// cambiaba lo que esperan). Cada preload deja ganar a lo que ya venga puesto fuera.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (!process.env.BOND_HOME) process.env.BOND_HOME = mkdtempSync(join(tmpdir(), "bond-home-"));
