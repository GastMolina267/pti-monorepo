# 02 · Stack tecnológico

Versiones fijadas al crear el monorepo (octubre 2026). Las de Angular y NestJS son las que soporta **Nx 23** ([ADR 0003](adr/0003-versiones-alineadas-a-nx.md)). Para actualizar se usa `pnpm nx migrate latest`, nunca a mano.

## Workspace

| Herramienta                                                        | Versión                                | Rol                                                                       |
| ------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------- |
| Node.js                                                            | ≥ 22.12 (recomendado 24 LTS, `.nvmrc`) | Runtime                                                                   |
| pnpm                                                               | 10.x (`packageManager`)                | Gestor de paquetes                                                        |
| Nx                                                                 | 23.2                                   | Monorepo: generadores, caché, `affected`, límites de módulos, MCP para IA |
| TypeScript                                                         | 6.0                                    | Lenguaje                                                                  |
| ESLint 9 (flat) + angular-eslint + `@nx/enforce-module-boundaries` |                                        | Lint                                                                      |
| Prettier 3                                                         |                                        | Formato                                                                   |
| Husky + lint-staged + commitlint                                   |                                        | Hooks: formato en pre-commit, Conventional Commits                        |
| GitHub Actions                                                     |                                        | CI: `nx affected -t lint test build`                                      |

## Backend (`apps/api`)

| Tecnología                                     | Versión      | Uso                                                              |
| ---------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| NestJS                                         | 11           | Framework (monolito modular)                                     |
| @nestjs/config + zod 4                         | 4.x / 4.6    | Config validada al arrancar                                      |
| @nestjs/swagger                                | 11           | OpenAPI en `/api/docs`                                           |
| class-validator / class-transformer            | 0.15         | Validación de DTOs                                               |
| webpack (vía `@nx/webpack`)                    | 5            | Build                                                            |
| jest                                           | 30           | Tests                                                            |
| TypeORM + @nestjs/typeorm + pg (PostgreSQL 16) | 1.1 / 11 / 8 | Persistencia y migraciones ([ADR 0009](adr/0009-orm-typeorm.md)) |
| @nestjs/jwt + bcryptjs                         | 11 / 3       | Login del personal (JWT) y hash de contraseñas                   |
| @nestjs/throttler                              | 6            | Rate limit (login, check-in)                                     |
| tsx                                            | 4            | CLI de migraciones y seed                                        |
| **Fase 2:** @nestjs/websockets + socket.io     |              | Tiempo real ([ADR 0007](adr/0007-tiempo-real-socket-io.md))      |
| **Fase 2:** mqtt.js                            |              | Cliente MQTT                                                     |

## Frontend (`apps/backoffice`, `apps/tv-display`, `libs/shared/ui`)

| Tecnología                    | Versión                            | Uso                                                       |
| ----------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Angular                       | 22 (standalone, zoneless, signals) | Framework ([ADR 0002](adr/0002-backoffice-en-angular.md)) |
| Angular Material + CDK        | 22.2 (M3)                          | Componentes, con tema Vitalia                             |
| @angular/build (esbuild)      | 22                                 | Build y dev-server                                        |
| @lucide/angular               | 1.x                                | Íconos (sin CDN)                                          |
| @fontsource/plus-jakarta-sans | 5                                  | Tipografía auto-hospedada                                 |
| Vitest + Analog               | 4.1                                | Tests                                                     |
| **Fase 3:** socket.io-client  |                                    | Tiempo real                                               |

## Infraestructura (`docker-compose.yml`, `infra/`)

| Servicio          | Imagen                                 | Puerto |
| ----------------- | -------------------------------------- | ------ |
| PostgreSQL        | `postgres:16-alpine`                   | 5432   |
| Eclipse Mosquitto | `eclipse-mosquitto:2`                  | 1883   |
| **Fase 4:** Nginx | `nginx:alpine`                         | 80/443 |
| **Fase 4:** API   | imagen propia (Dockerfile multi-stage) | 3000   |

## Fuera del monorepo

| Componente                            | Stack                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Portal cautivo (`pti-captive-portal`) | React 18 + Vite + MUI, UAM/CHAP con el RUT956                               |
| Firmware del wearable                 | C/C++ en ESP32-C3 (Arduino/ESP-IDF), mbedTLS AES-GCM, PubSubClient/ESP-MQTT |
| Red                                   | Teltonika RUT956 (RutOS): VLANs, portal cautivo, failover 4G                |
