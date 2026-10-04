# 0008. AGENTS.md como fuente única de contexto + skills del proyecto

- Estado: Aceptado
- Fecha: 2026-10-03

## Contexto

El equipo usa varias IAs (Claude Code, Codex, Cursor, Gemini/Antigravity, Copilot). Mantener instrucciones distintas para cada una lleva a contradicciones.

## Decisión

- `AGENTS.md` en la raíz y en cada proyecto es la **fuente única**. `CLAUDE.md` (con `@AGENTS.md`), `GEMINI.md` y `.github/copilot-instructions.md` solo apuntan a él. Gemini lo lee vía `contextFileName`.
- Skills del proyecto en `.agents/skills/vitalia-*` (formato SKILL.md), copiadas a `.claude/`, `.cursor/` y `.github/skills` con `pnpm ai:sync`.
- Skills oficiales de Nx y Nx MCP, configurados por `create-nx-workspace`.

## Consecuencias

- (+) Una sola verdad. Cualquier IA arranca con el mismo contexto y los mismos procedimientos.
- (−) Hay que correr `pnpm ai:sync` después de editar una skill (no se usan symlinks por compatibilidad con Windows).
