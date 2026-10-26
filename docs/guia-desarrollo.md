# Guía de desarrollo

## Requisitos (Windows)

| Herramienta           | Cómo instalar                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Node.js 24 LTS        | [nodejs.org](https://nodejs.org) o `winget install OpenJS.NodeJS.LTS` (o `fnm` / `nvm-windows` con `.nvmrc`)          |
| pnpm 10               | `corepack enable` y luego `corepack prepare pnpm@10.34.6 --activate` (o `npm i -g pnpm@10`)                           |
| Docker Desktop        | Para PostgreSQL y Mosquitto (`pnpm infra:up`)                                                                         |
| Git                   | `winget install Git.Git`                                                                                              |
| VS Code + extensiones | Abrí el repo y aceptá las recomendadas (`.vscode/extensions.json`): **Nx Console**, Angular, ESLint, Prettier, Vitest |

> ⚠️ **OneDrive:** si el repo está dentro de una carpeta sincronizada (Escritorio/Documentos con OneDrive), `node_modules` y `.nx/cache` generan miles de archivos que OneDrive intenta subir. Opciones: mover el repo a una carpeta fuera de OneDrive (ej. `C:\dev\pti-monorepo`), o marcar `node_modules` como "liberar espacio / no sincronizar".

## Primer arranque

```powershell
cd pti-monorepo
git init -b main          # si el repo todavía no tiene git (Husky lo necesita)
pnpm install
copy .env.example .env    # completar secretos si hace falta
pnpm infra:up             # PostgreSQL + Mosquitto (Docker Desktop abierto)
pnpm db:migrate           # crear las tablas
pnpm db:seed              # datos simulados (usuarios, servicios, turnos del día)
pnpm dev                  # API :3000 · Backoffice :4200 · TV :4300
```

- Backoffice: <http://localhost:4200> → login con un usuario del seed. El punto "En vivo" de la barra confirma el tiempo real.
- TV llamador: <http://localhost:4300> (sin login).
- Para ver signos vitales y alertas en vivo: `pnpm sim:wearables` en otra terminal (con `TELEMETRY_AES_KEY` en el `.env`), y `fall 3` para simular una caída.

> ⚠️ **`.env` de antes de la Fase 3:** si tu `.env` tiene `PORT=3000`, cambialo a `API_PORT=3000`. El dev-server de Angular usa `PORT` por encima de su configuración y Nx carga el `.env` en todas las tareas, así que Backoffice y TV intentan levantar en el 3000.

### Sonido de las alertas y del llamador

Los navegadores bloquean el audio hasta que el usuario toca la página. El Backoffice lo habilita con el click del login (o el botón "Activar sonido") y la TV muestra "Tocá la pantalla para activar el sonido". En el kiosco de la TV, abrí Chrome con `--kiosk --autoplay-policy=no-user-gesture-required http://<gateway>:4300` para que suene sin tocar nada.

- Swagger: <http://localhost:3000/api/docs> → `POST /api/auth/login` con `medico@vitalia.local` / `Vitalia2026!`, después **Authorize** con el `accessToken`

Usuarios del seed (clave `Vitalia2026!`): `admin@`, `enfermeria@`, `medico@`, `pediatria@`, `recepcion@` + `vitalia.local`.

### Test de integración de la API (opcional)

```powershell
docker compose exec postgres createdb -U vitalia vitalia_test
$env:TEST_DATABASE_URL="postgresql://vitalia:vitalia@localhost:5432/vitalia_test"; pnpm nx test api
```

Sin `TEST_DATABASE_URL`, ese test se saltea. En CI corre siempre contra un PostgreSQL de servicio.

## Firmware del wearable (`apps/wearable-firmware-poc`)

Solo hace falta si trabajás con el firmware. El resto del monorepo (`pnpm affected`, `pnpm check`) no necesita PlatformIO.

1. Instalá **PlatformIO**: la extensión `platformio.platformio-ide` de VS Code, o PlatformIO Core con `pip install platformio`.
2. Si usás la extensión, `pio` no queda en el PATH. Agregá `%USERPROFILE%\.platformio\penv\Scripts` a las variables de entorno del usuario y reabrí la terminal.
3. Copiá las credenciales: `copy apps\wearable-firmware-poc\src\secrets.h.example apps\wearable-firmware-poc\src\secrets.h`, y completá el SSID de 2.4 GHz y la IP del broker. `secrets.h` **no se versiona**.
4. Desde la raíz:

```powershell
pnpm fw:build      # compilar
pnpm fw:upload     # flashear por USB-C (cerrá el monitor serie antes)
pnpm fw:monitor    # monitor serie a 115200
```

- La extensión de VS Code espera el `platformio.ini` en la raíz de la carpeta abierta. Para usar sus botones e IntelliSense, abrí `apps/wearable-firmware-poc` en una ventana aparte (`code apps/wearable-firmware-poc`).
- Para probar MQTT sin el gateway: `pnpm infra:up` levanta Mosquitto en tu notebook (puerto 1883). Poné la IP de la notebook en `MQTT_BROKER`.
- **Clave de cifrado:** generá una con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y poné **la misma** en `TELEMETRY_AES_KEY` del `.env` y en `TELEMETRY_AES_KEY_HEX` del `secrets.h`. Sin clave, el firmware no publica.
- **Verificar la telemetría:** `pnpm fw:mqtt-check` se suscribe a Mosquitto, descifra cada sobre y valida la lectura contra el contrato (✔ / ⚠ / ✖ por mensaje).
- Pinout, gotchas de hardware y el contrato MQTT: [`apps/wearable-firmware-poc/AGENTS.md`](../apps/wearable-firmware-poc/AGENTS.md). Estado de los hitos de hardware: [`ESTADO.md`](../apps/wearable-firmware-poc/ESTADO.md).

## App del paciente (`apps/patient-app`)

Solo hace falta si trabajás con la app. Guía completa en [11-app-paciente.md](11-app-paciente.md).

1. Instalá **Flutter 3.44** (stable): descomprimilo, por ejemplo, en `C:\src\flutter` y agregá `C:\src\flutter\bin` al PATH. También **Android Studio** con el SDK y un AVD (`Pixel_8`). Corré `flutter doctor --android-licenses` y `flutter doctor`.
2. Desde la raíz:

```powershell
pnpm app:emulator    # levanta el emulador Pixel_8
pnpm nx serve api    # en otra terminal (con infra:up, db:migrate y db:seed hechos)
pnpm app:run         # corre la app en el emulador contra http://10.0.2.2:3000
pnpm app:test        # flutter analyze + flutter test
```

- Si cambiás constantes o etiquetas en `libs/shared`, corré `pnpm app:codegen` (la CI lo verifica).
- Para un teléfono real, bajá el APK de la CI (artefacto `vitalia-paciente-apk`) o generalo con `pnpm app:apk`.

## Flujo de trabajo

1. Tomá una tarea de [07-roadmap.md](07-roadmap.md).
2. Creá la rama desde `main` actualizado: `git checkout -b feature/f1-tickets-module origin/main`.
3. Si involucra un contrato, empezá por `libs/shared/contracts`.
4. Implementá con los generadores de Nx (o Nx Console en VS Code).
5. `pnpm affected` (lint + test + build de lo afectado).
6. Actualizá `docs/` y marcá la tarea en el roadmap.
7. Commit con Conventional Commits (`feat(api): …`) y PR a `main` (ver [convenciones de Git](05-convenciones.md#git)).

## Trabajar con IA

El repo está preparado para que cualquier asistente arranque con el contexto completo:

- **`AGENTS.md`** (raíz y por proyecto): qué es, mapa, comandos y reglas de oro. Claude Code lo carga desde `CLAUDE.md`, Gemini/Antigravity y Codex lo leen directo, Cursor y Copilot también.
- **Skills** (`.agents/skills/vitalia-*` y las de Nx): procedimientos paso a paso (crear un módulo Nest, una feature Angular, un contrato, aplicar la identidad, MQTT, tiempo real, documentar).
- **Nx MCP**: el asistente puede consultar el grafo de proyectos, los targets y la doc de Nx.

### Cómo pedir tareas (prompts que funcionan)

```text
Leé AGENTS.md y docs/07-roadmap.md. Implementá la tarea "Módulo tickets" de la Fase 1
siguiendo la skill vitalia-nest-module. Empezá por los contratos. Al terminar corré
pnpm affected, actualizá docs/04-contratos.md y marcá la tarea en el roadmap.
```

```text
En apps/backoffice, creá la feature "fila de triaje" (Fase 3) con la skill
vitalia-angular-feature y vitalia-design-system. Usá datos mock tipados con
@vitalia/contracts hasta que exista el endpoint.
```

### Buenas prácticas

- **Una tarea del roadmap por sesión.** Pedí primero un plan y después la implementación.
- Pedile siempre que **corra `pnpm affected`** y que **actualice la doc** (skill `vitalia-docs`).
- Si la IA toma una decisión técnica relevante, pedile un **ADR**.
- Revisá los diffs: la IA no reemplaza la revisión, sobre todo en seguridad y en reglas clínicas.
- Si cambiás una skill, corré `pnpm ai:sync`.

## Comandos útiles de Nx

```bash
pnpm nx graph                         # grafo interactivo
pnpm nx show project api              # targets de un proyecto
pnpm nx g @nx/angular:component ...   # generadores (o Nx Console)
pnpm nx affected -t test              # solo lo afectado por tus cambios
pnpm nx reset                         # limpiar caché si algo se comporta raro
```
