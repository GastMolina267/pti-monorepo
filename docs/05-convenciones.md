# 05 · Convenciones

## Idioma

- **Código** (identificadores, nombres de archivo, rutas de API): inglés. `Ticket`, `assessVitals`, `/api/tickets`.
- **UI, docs, commits, comentarios de dominio:** español rioplatense con voseo.

## Estructura y nombres

| Elemento                | Convención                                                         | Ejemplo                              |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| Apps                    | `apps/<nombre>` kebab-case                                         | `apps/tv-display`                    |
| Libs compartidas        | `libs/shared/<nombre>`                                             | `libs/shared/contracts`              |
| Libs por app (futuro)   | `libs/<app>/<tipo>-<nombre>`                                       | `libs/backoffice/feature-triage`     |
| Alias                   | `@vitalia/<nombre>`                                                | `@vitalia/ui`                        |
| Tags Nx                 | `scope:<app\|shared>` + `type:<app\|feature\|data\|ui\|contracts>` | `scope:shared,type:ui`               |
| Módulo Nest             | `modules/<dominio>/<dominio>.{module,controller,service}.ts`       | `modules/tickets/tickets.service.ts` |
| DTO Nest                | `dto/<acción>-<entidad>.dto.ts`                                    | `dto/create-ticket.dto.ts`           |
| Componente Angular      | `features/<feature>/<nombre>.{ts,html,scss}`, clase sin sufijo     | `triage-queue.ts` → `TriageQueue`    |
| Selector Angular        | prefijo `vt-`                                                      | `vt-triage-queue`                    |
| Servicio de API (front) | `core/api/<recurso>.api.ts`                                        | `tickets.api.ts` → `TicketsApi`      |
| Eventos WS              | `<dominio>:<acción>`                                               | `ticket:called`                      |
| Variables de entorno    | `UPPER_SNAKE`                                                      | `TELEMETRY_AES_KEY`                  |

## TypeScript

- `strict`, sin `any` (usá `unknown` y validá). Tipos compartidos solo en `@vitalia/contracts`.
- Enumeraciones como `const` + tipo derivado, no `enum`.
- Fechas en JSON como ISO-8601 (`string`). Montos y medidas con su unidad en el JSDoc.

## Git

- **Ramas (Gitflow):** `main` (entregas estables), `develop` (integración), `feature/<fase>-<descripción>` (ej. `feature/f1-tickets-module`), `fix/<descripción>`.
- **Commits (Conventional Commits, validados por commitlint):** `<tipo>(<scope>): <descripción en español>`.
  - Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`.
  - Scopes: `api`, `backoffice`, `tv-display`, `contracts`, `design-tokens`, `ui`, `infra`, `docs`, `ai`, `ci`, `deps`, `repo`.
  - Ej.: `feat(api): agregar módulo de turnos con llamado a consultorio`.
- **PRs** hacia `develop`, con la CI en verde (`nx affected -t lint test build`) y la doc actualizada.

## Testing

| Proyecto                         | Runner           | Qué testear                                                                |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| `contracts`                      | vitest           | Toda función pura (reglas clínicas, helpers)                               |
| `api`                            | jest             | Services (lógica), controllers (contrato HTTP), validación de DTOs, config |
| `backoffice`, `tv-display`, `ui` | vitest + TestBed | Estados de render, `computed`, interacción                                 |

Antes de cerrar una tarea: `pnpm affected` en verde.

## Seguridad

- Nunca commitear `.env`, claves ni datos reales de pacientes. Usá `.env.example` como plantilla.
- Validá toda entrada (DTOs en la API, zod en MQTT).
- Los secretos (`TELEMETRY_AES_KEY`, `JWT_SECRET`) se generan por entorno.

## Trabajo con IA

Ver [guia-desarrollo.md](guia-desarrollo.md#trabajar-con-ia).
