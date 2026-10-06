# AGENTS.md — Vitalia · Ecosistema Digital Hospitalario

> Fuente única de contexto para agentes de IA (Claude Code, Codex, Cursor, Gemini/Antigravity, Copilot, OpenCode).
> `CLAUDE.md`, `GEMINI.md` y `.github/copilot-instructions.md` apuntan acá. **Leé este archivo completo antes de tocar código.**

## Qué es

Monorepo **Nx** del Proyecto Tecnológico Integrador (Ingeniería Informática, UBP, 2026). Ecosistema para hospitales de baja y media complejidad: **conectividad gestionada + turnos omnicanal + monitoreo biométrico IoMT**, que corre en un **Edge Gateway local (Fog Computing)** y sigue funcionando sin internet.

- Visión, problema y alcance: [`docs/00-vision.md`](docs/00-vision.md)
- Arquitectura: [`docs/01-arquitectura.md`](docs/01-arquitectura.md)
- **Fase actual y próximos pasos: [`docs/07-roadmap.md`](docs/07-roadmap.md)** ← revisalo para saber qué construir

## Mapa del monorepo

| Proyecto                | Ruta                         | Tipo / tags                      | Stack                                                        | Puerto dev                         |
| ----------------------- | ---------------------------- | -------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `api`                   | `apps/api`                   | `scope:api`, `type:app`          | NestJS 11 + TypeORM (PostgreSQL 16), JWT                     | 3000 (`/api`, Swagger `/api/docs`) |
| `backoffice`            | `apps/backoffice`            | `scope:backoffice`, `type:app`   | Angular 22 + Angular Material (consola de triaje)            | 4200                               |
| `tv-display`            | `apps/tv-display`            | `scope:tv`, `type:app`           | Angular 22 (llamador de turnos, modo kiosco)                 | 4300                               |
| `wearable-firmware-poc` | `apps/wearable-firmware-poc` | `scope:wearable`, `type:app`     | C++17 · PlatformIO + Arduino en ESP32-C3 (MQTT, AES-256-GCM) | — (USB, monitor serie 115200)      |
| `contracts`             | `libs/shared/contracts`      | `scope:shared`, `type:contracts` | TS puro: tipos REST, eventos WS, MQTT, reglas clínicas       | —                                  |
| `design-tokens`         | `libs/shared/design-tokens`  | `scope:shared`, `type:ui`        | SCSS + TS: identidad Vitalia, tema Material                  | —                                  |
| `ui`                    | `libs/shared/ui`             | `scope:shared`, `type:ui`        | Componentes Angular compartidos (logo, tema)                 | —                                  |

Fuera de este repo: **portal cautivo** (`pti-captive-portal`, React + Vite, UAM/CHAP con el router RUT956), que consume los contratos documentados en [`docs/04-contratos.md`](docs/04-contratos.md). El firmware del wearable está en `apps/wearable-firmware-poc` ([ADR 0010](docs/adr/0010-firmware-del-wearable-en-el-monorepo.md)). Implementa el contrato MQTT de `@vitalia/contracts` en C++ y no importa TypeScript.

Alias de import: `@vitalia/contracts`, `@vitalia/design-tokens`, `@vitalia/ui` (en `tsconfig.base.json`).

## Comandos

```bash
pnpm install              # Node >= 22.12, pnpm 10
pnpm infra:up             # PostgreSQL 16 + Mosquitto 2 (Docker)
pnpm db:migrate           # migraciones TypeORM · db:generate --name=X · db:revert · db:seed · db:reset
pnpm dev                  # api + backoffice + tv-display
pnpm dev:api | dev:backoffice | dev:tv
pnpm fw:build | fw:upload | fw:monitor   # firmware del wearable (requiere PlatformIO en el PATH)
pnpm nx test <proyecto>   # vitest (front/libs) · jest (api)
pnpm nx lint <proyecto>
pnpm affected             # lint + test + build de lo afectado (usar antes de terminar)
pnpm check                # todo + format:check
pnpm nx graph             # grafo de dependencias
pnpm ai:sync              # copiar skills de .agents/skills a .claude/.cursor/.github
```

Siempre ejecutá tareas **vía Nx** (`pnpm nx ...`), nunca la herramienta subyacente directo.

## Reglas de oro

1. **Contratos primero.** Todo tipo, evento, tópico o regla compartida entre front y back vive en `@vitalia/contracts`. Se cambia ahí primero y después en API y frontends. Ver skill `vitalia-contracts`.
2. **Respetá los límites de módulos.** `@nx/enforce-module-boundaries` está activo: la API nunca importa `type:ui`; cada app solo usa sus libs más las `scope:shared`.
3. **Offline-first (RNF-O2).** Nada de CDNs ni servicios externos en tiempo de ejecución: fuentes auto-hospedadas (`@fontsource`), íconos `@lucide/angular`, sin Google Fonts ni Material Icons por URL. El gateway funciona 24 h sin WAN.
4. **Identidad Vitalia.** Usá los tokens `--vt-*` y las utilidades `.vt-*` de `@vitalia/design-tokens`. No pongas hex sueltos en componentes. Guía: [`docs/06-identidad-visual.md`](docs/06-identidad-visual.md), skill `vitalia-design-system`.
5. **Angular moderno.** Componentes standalone, `ChangeDetectionStrategy.OnPush`, zoneless, signals (`signal`, `computed`, `input()`), `inject()`, control flow (`@if`, `@for`) y `httpResource`. Archivos sin sufijo `.component` (convención Angular 22). Rutas lazy con `loadComponent`.
6. **NestJS por dominio.** Un módulo por dominio en `apps/api/src/modules/<dominio>/`. DTOs con `class-validator` y `@nestjs/swagger`. La config se lee solo con `ConfigService<Env, true>`, nunca con `process.env` directo. Todo endpoint es privado (JWT global) salvo `@Public()`. Los cambios de esquema van **siempre** por migración TypeORM. Skills `vitalia-nest-module` y `vitalia-database`.
7. **Idioma.** Identificadores y código en **inglés**. Textos de UI, documentación, comentarios de dominio y commits en **español rioplatense** (voseo: "Conectate", "Seguí tu turno").
8. **Datos sensibles.** Signos vitales y datos de pacientes son datos sensibles (Ley 25.326). En desarrollo se usan **solo datos simulados**. Nunca commitees `.env`, claves AES ni secretos.
9. **Tests.** Toda lógica nueva lleva su test. Las reglas clínicas puras van en `contracts` con vitest. Antes de dar una tarea por terminada, `pnpm affected` tiene que pasar.
10. **Documentá.** Si cambia la arquitectura, un contrato, una decisión técnica o el avance del roadmap, actualizá `docs/` (y escribí un ADR en `docs/adr/` si es una decisión). Skill `vitalia-docs`.
11. **Generadores Nx.** Para crear apps, libs o componentes usá los generadores (skill `nx-generate`), con los tags correctos.
12. **Commits.** Conventional Commits con el proyecto como scope: `feat(api): ...`, `fix(backoffice): ...`, `docs(roadmap): ...`. Ramas Gitflow: `main`, `develop`, `feature/*`.

## Skills del proyecto

Están en `.agents/skills/` (fuente) y se copian a `.claude/skills`, `.cursor/skills` y `.github/skills` con `pnpm ai:sync`.

| Skill                     | Cuándo usarla                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `vitalia-domain`          | Cualquier feature que toque turnos, triaje, signos vitales, alertas, red o wearables |
| `vitalia-contracts`       | Agregar o cambiar tipos, eventos WS, tópicos MQTT o reglas compartidas               |
| `vitalia-nest-module`     | Crear o extender un módulo/endpoint en la API                                        |
| `vitalia-database`        | Entidades TypeORM, migraciones, seed y consultas a PostgreSQL                        |
| `vitalia-angular-feature` | Crear pantallas o features en el Backoffice o la TV                                  |
| `vitalia-design-system`   | Aplicar la identidad visual (colores, tipografía, componentes, estados clínicos)     |
| `vitalia-realtime`        | Eventos en tiempo real con Socket.IO (API ↔ Backoffice/TV/portal)                    |
| `vitalia-mqtt-telemetry`  | Ingesta MQTT, descifrado AES-256-GCM, simulador de wearables y alertas               |
| `vitalia-docs`            | Documentar: ADRs, roadmap, docs técnicas, changelog                                  |

Además están las skills oficiales de Nx (`nx-workspace`, `nx-generate`, `nx-run-tasks`, `nx-plugins`, etc.) y el **Nx MCP** configurado para cada herramienta.

## Documentación

| Doc                                                          | Contenido                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [`docs/00-vision.md`](docs/00-vision.md)                     | Problema, objetivos, alcance (incluye y excluye)             |
| [`docs/01-arquitectura.md`](docs/01-arquitectura.md)         | Capas Edge/Fog/Cloud, red y VLANs, flujos, mapa del monorepo |
| [`docs/02-stack.md`](docs/02-stack.md)                       | Tecnologías y versiones                                      |
| [`docs/03-dominio.md`](docs/03-dominio.md)                   | Glosario, requerimientos RF/RNF, umbrales clínicos           |
| [`docs/04-contratos.md`](docs/04-contratos.md)               | REST, eventos WebSocket, MQTT y cifrado                      |
| [`docs/05-convenciones.md`](docs/05-convenciones.md)         | Código, estructura, Git, testing                             |
| [`docs/06-identidad-visual.md`](docs/06-identidad-visual.md) | Marca Vitalia                                                |
| [`docs/07-roadmap.md`](docs/07-roadmap.md)                   | Plan por fases e hitos                                       |
| [`docs/08-modelo-datos.md`](docs/08-modelo-datos.md)         | Diagrama ER, reglas del modelo, migraciones y seed           |
| [`docs/adr/`](docs/adr/)                                     | Registro de decisiones de arquitectura                       |
| [`docs/guia-desarrollo.md`](docs/guia-desarrollo.md)         | Setup en Windows, flujo de trabajo con IA                    |

## Equipo

| Integrante            | Rol principal                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Gastón Molina         | Backend Fog: NestJS, PostgreSQL, Mosquitto (`apps/api`, `libs/shared/contracts`)            |
| Tomás Molina          | Interfaces: Backoffice, TV y app/portal del paciente (`apps/backoffice`, `apps/tv-display`) |
| Facundo Gomez Geneiro | Hardware, firmware IoMT y red (router RUT956, `apps/wearable-firmware-poc`)                 |

Tutor: Oscar Luis Gencarelli. Hitos: **Hito 3 (octubre 2026)**, ecosistema integrado de punta a punta. **Hito 4 (noviembre 2026)**, validación y defensa.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
