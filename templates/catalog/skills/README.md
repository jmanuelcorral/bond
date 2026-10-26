# Skills

Una carpeta por skill, con un `SKILL.md` dentro. El nombre de la carpeta es el nombre de la
skill: el que se elige en `bond init` y se escribe en `skills = [...]` de `.bond/bond.toml`.

```text
skills/
└── revisar-migraciones/
    ├── SKILL.md          # obligatorio
    ├── scripts/          # opcional: lo que la skill ejecuta
    └── references/       # opcional: detalle que el agente lee solo si lo necesita
```

## `SKILL.md`

```markdown
---
name: revisar-migraciones
description: Revisar una migración de base de datos antes de aplicarla - bloqueos, datos que se pierden y vuelta atrás. Úsalo al crear o cambiar ficheros en db/migrations.
---

# Revisar migraciones

Pasos, criterios y ejemplos para el agente.
```

- `name`: igual que la carpeta. Minúsculas, dígitos y `-`.
- `description`: qué hace y **cuándo** usarla. Es lo único que el agente lee para decidir si la
  carga, así que nombra las situaciones en las que aplica.
- El cuerpo, corto: lo que el agente no sabría sin él. El detalle largo, en `references/`.

## En `bond init`

Por defecto la skill sale marcada y con el principio de su `description`. Para darle un resumen
o dejarla sin marcar, añade su entrada en `catalog.toml`:

```toml
[skills.revisar-migraciones]
summary = "Revisar una migración antes de aplicarla"
default = false
```

## Comprobar

```bash
bond catalog check
```

Errores típicos: carpeta sin `SKILL.md`, `name` distinto del nombre de la carpeta, falta
`description`, entrada en `catalog.toml` de una skill que no existe.
