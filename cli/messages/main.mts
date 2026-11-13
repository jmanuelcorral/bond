/**
 * Textos de la consola de bond del área ayuda general de bond (bond --help).
 *
 * Las claves se tipan contra `es`: si añades una clave aquí y no su traducción en `en`,
 * `npm run typecheck` falla. Este fichero lo mantiene una sola rama del equipo del i18n:
 * no lo edites desde dos ramas a la vez.
 */

export const es = {
	"main.help": `Uso: bond [comando] [opciones]   (bond <comando> --help para el detalle)

Máquina
  setup        Deja la máquina lista: Herdr, endpoints de modelos, agentes, instrucciones
  doctor       Comprueba la instalación y lo que depende de fuera
  models       Registro global de modelos y su configuración en cada agente
  run          Lanza un agente con su entorno de modelos (hoy: copilot)
  update       Pone bond al día con la última release

Repo
  init         Prepara el repo para los agentes: .bond/bond.toml, AGENTS.md y su config
  sync         Regenera la config de cada agente desde .bond/bond.toml
  decisions  Memoria de decisiones del repo: add, accept, show, runs, check
  catalog      Catálogo propio de skills, comandos y MCP para el equipo (create, check)
  hub          Sesión del repo hub (repos, bases y enlaces) declarada en hub.toml; check lo revisa

Trabajo diario (Herdr)
  app            Abre bond-app (orquestador en primer plano y herdr-app)
  (sin comando)  Comportamiento por defecto (bond app o puesto de trabajo)
  dev [dir]      Lo mismo para otro directorio (--agent, --worktree…)
  team           Un agente por rama, cada uno en su worktree (status, prompt, clean)
  status         Agentes vivos en Herdr
  sessions       Sesiones de pi y cómo retomarlas
  budget         Estado de presupuesto de tus agentes
  summary        Resumen de sesión determinista y pegable
  handoff        Propuesta de traspaso al quedarte sin presupuesto: candidatos y comando (lo lanzas tú)

Otros
  logo         El logo de BOND
  version      Versión de bond`,
	"main.status_help": "Uso: bond status [--json]",
	"main.migrate_nothing": "nada que migrar",
	"main.unknown_cmd": "comando desconocido: {cmd} (bond help)",
} as const;

export const en: Record<keyof typeof es, string> = {
	"main.help": `Usage: bond [command] [options]   (bond <command> --help for details)

Machine
  setup        Sets the machine up: Herdr, model endpoints, agents, instructions
  doctor       Checks the installation and external dependencies
  models       Global model registry and agent configuration
  run          Runs an agent with its model environment (today: copilot)
  update       Brings bond up to date with the latest release

Repo
  init         Prepares the repo for agents: .bond/bond.toml, AGENTS.md and config
  sync         Regenerates agent config from .bond/bond.toml
  decisions  The repo's decision memory: add, accept, show, runs, check
  catalog      Team catalog of skills, commands and MCP (create, check)
  hub          Hub repo session (repos, bases and links) declared in hub.toml; check inspects it

Daily work (Herdr)
  app            Opens bond-app (foreground orchestrator and herdr-app)
  (no command)   Default command (bond app or repo workstation)
  dev [dir]      The same for another directory (--agent, --worktree…)
  team           One agent per branch, each in its own worktree (status, prompt, clean)
  status         Live agents in Herdr
  sessions       pi sessions and how to resume them
  budget         Budget status for your agents
  summary        Pasteable deterministic session summary
  handoff        Handoff proposal when out of budget: candidates and command (you launch it)

Other
  logo         The BOND logo
  version      bond version`,
	"main.status_help": "Usage: bond status [--json]",
	"main.migrate_nothing": "nothing to migrate",
	"main.unknown_cmd": "unknown command: {cmd} (bond help)",
};
