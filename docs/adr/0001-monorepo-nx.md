# 0001. Usar un monorepo Nx con pnpm

- Estado: Aceptado
- Fecha: 2026-10-03
- Autores: Equipo PTI

## Contexto

El proyecto tiene un backend (NestJS) y varios frontends (Backoffice, TV, landing a futuro) que comparten contratos (tipos, eventos, tópicos MQTT) e identidad visual. El desarrollo se apoya fuerte en asistentes de IA, que rinden mejor con todo el contexto en un solo lugar.

## Decisión

Un único repositorio **Nx 23** con **pnpm**, preset integrado (alias por `paths` en `tsconfig.base.json`), apps en `apps/` y libs en `libs/`. Límites de dependencias con tags y `@nx/enforce-module-boundaries`.

## Alternativas consideradas

- **Repos separados:** duplica contratos y estilos, y la IA pierde el contexto cruzado.
- **Turborepo / pnpm workspaces solos:** sin generadores de Angular/Nest ni límites de módulos, y menos integración con IA (Nx trae skills y MCP).
- **Preset "TS solution" (project references) de Nx 23:** no compatible con Angular (el plugin lo rechaza).

## Consecuencias

- (+) Contratos compartidos en `@vitalia/contracts`, CI con `nx affected`, caché de tareas, grafo de dependencias.
- (+) Skills oficiales de Nx y Nx MCP para cada herramienta de IA.
- (−) Curva de aprendizaje de Nx. Las versiones de los frameworks quedan atadas a Nx ([ADR 0003](0003-versiones-alineadas-a-nx.md)).
