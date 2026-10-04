<p align="center">
  <img src="libs/shared/design-tokens/src/assets/vitalia-isotipo.svg" width="72" alt="Vitalia" />
</p>

<h1 align="center">Vitalia</h1>
<p align="center"><b>Ecosistema Digital Hospitalario</b> · Conectividad gestionada · Turnos omnicanal · Monitoreo biométrico IoMT</p>
<p align="center">Proyecto Tecnológico Integrador — Ingeniería Informática, Universidad Blas Pascal (2026)</p>

---

Monorepo **Nx** con el backend del **Edge Gateway** y las interfaces del personal de salud. Todo corre localmente en el hospital (Fog Computing) y sigue operando **sin internet**.

| Proyecto                                                 | Descripción                                                                         | Stack                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| [`apps/api`](apps/api)                                   | Backend único: turnos, check-in, auth; luego telemetría MQTT, alertas y tiempo real | NestJS 11 + TypeORM   |
| [`apps/backoffice`](apps/backoffice)                     | Consola de triaje y monitoreo para el personal                                      | Angular 22 + Material |
| [`apps/tv-display`](apps/tv-display)                     | Llamador de turnos para la sala de espera                                           | Angular 22            |
| [`libs/shared/contracts`](libs/shared/contracts)         | Contratos compartidos (REST, WS, MQTT, reglas clínicas)                             | TypeScript            |
| [`libs/shared/design-tokens`](libs/shared/design-tokens) | Identidad visual Vitalia                                                            | SCSS + TS             |
| [`libs/shared/ui`](libs/shared/ui)                       | Componentes Angular de marca                                                        | Angular               |

Repos relacionados: portal cautivo (`pti-captive-portal`, React) y firmware del wearable (ESP32-C3).

## Inicio rápido

```bash
pnpm install
cp .env.example .env
pnpm infra:up     # PostgreSQL 16 + Mosquitto 2 (Docker)
pnpm db:migrate   # tablas (TypeORM)
pnpm db:seed      # datos simulados · usuarios *@vitalia.local / Vitalia2026!
pnpm dev          # API :3000 · Backoffice :4200 · TV :4300
```

Swagger: <http://localhost:3000/api/docs> · Setup completo en Windows: [docs/guia-desarrollo.md](docs/guia-desarrollo.md)

## Scripts

| Script                                               | Acción                             |
| ---------------------------------------------------- | ---------------------------------- |
| `pnpm dev` / `dev:api` / `dev:backoffice` / `dev:tv` | Servidores de desarrollo           |
| `pnpm affected`                                      | Lint + test + build de lo afectado |
| `pnpm check`                                         | Todo el workspace + format check   |
| `pnpm infra:up` / `infra:down` / `infra:logs`        | Infraestructura Docker             |
| `pnpm graph`                                         | Grafo de dependencias de Nx        |
| `pnpm ai:sync`                                       | Sincroniza las skills de IA        |

## Documentación

Todo está en [`docs/`](docs/README.md): visión, arquitectura, dominio, contratos, convenciones, identidad visual, **[roadmap por fases](docs/07-roadmap.md)** y ADRs.

## Desarrollo con IA

El repo está preparado para Claude Code, Codex, Cursor, Gemini/Antigravity y Copilot: [`AGENTS.md`](AGENTS.md) es la fuente única de contexto y hay **skills** del proyecto en `.agents/skills/` además del Nx MCP. Ver [guía](docs/guia-desarrollo.md#trabajar-con-ia).

## Equipo

Facundo Gomez Geneiro · Gastón Molina · Tomás Molina — Tutor: Oscar Luis Gencarelli
