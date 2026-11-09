/**
 * Textos de la consola de bond del área budget (presupuesto de los agentes, epic #84).
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla.
 */

export const es = {
	"budget.help": `Uso: bond budget

Estado de presupuesto de tus agentes (epic de handoff #84): qué le queda a cada uno
y desde dónde se sabe. Los eventos los registran los hooks que instala \`bond sync\`
(~/.bond/events/); Codex añade los números exactos desde su transcript local.

  ok          con margen
  low         por encima del ${"80"}% de la ventana
  exhausted   límite alcanzado
  unknown     sin señal: no hay hook instalado o el proveedor no da números

El traspaso entre agentes (bond handoff) se apoya en esta información: se propone,
lo decides tú.`,
	"budget.title": "Presupuesto de tus agentes (eventos de los últimos {days} días)",
	"budget.hook_pending": "hook de presupuesto sin instalar: {path} (bond sync)",
	"budget.hook_installed": "hook de presupuesto: {path}",
	"budget.hook_unreadable": "no se puede tocar {path}: el JSON no se lee (hook de presupuesto sin instalar)",
	"budget.hook_machine": "hook de la máquina: `bond sync` lo instala, `--check` no lo cuenta",
};

export const en: Record<keyof typeof es, string> = {
	"budget.help": `Usage: bond budget

Budget status of your agents (handoff epic #84): how much each one has left and where
it is known from. Events are recorded by the hooks \`bond sync\` installs
(~/.bond/events/); Codex adds exact numbers from its local transcript.

  ok          with margin
  low         above ${"80"}% of the window
  exhausted   limit reached
  unknown     no signal: no hook installed or the provider gives no numbers

Handing off between agents (bond handoff) relies on this: it is proposed, you decide.`,
	"budget.title": "Budget of your agents (events from the last {days} days)",
	"budget.hook_pending": "budget hook not installed: {path} (bond sync)",
	"budget.hook_installed": "budget hook: {path}",
	"budget.hook_unreadable": "can't touch {path}: JSON doesn't parse (budget hook not installed)",
	"budget.hook_machine": "machine hook: `bond sync` installs it, `--check` does not count it",
};
