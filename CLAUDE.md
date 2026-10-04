# CLAUDE.md

Todo el contexto del proyecto está en AGENTS.md (fuente única para todas las IAs):

@AGENTS.md

## Específico de Claude Code

- Skills del proyecto: `.claude/skills/vitalia-*` (copiadas desde `.agents/skills` con `pnpm ai:sync`). Las skills de Nx llegan por el plugin `nx@nx-claude-plugins` (`.claude/settings.json`).
- Cada app/lib tiene su propio `CLAUDE.md` → `AGENTS.md` con reglas locales; leelo al trabajar en esa carpeta.
