# 0010. Llevar el firmware del wearable al monorepo

- Estado: Aceptado
- Fecha: 2026-10-06
- Autores: Facundo Gomez Geneiro

## Contexto

El firmware del wearable (ESP32-C3, PlatformIO + Arduino, C++17) vivía en un repo aparte (`mordecoi/POC-PTI`). Ahí se hizo la validación de hardware por hitos: I²C, OLED, MPU6050, MLX90614 y Wi-Fi. Ahora pasa de POC a desarrollo real contra la plataforma: MQTT, AES-256-GCM y `TelemetryReading` (Fase 2).

Al estar separado, el firmware definía su propio contrato MQTT. Usaba AES-256-CBC, el payload `device_id/bpm/temp_c/event` y un tópico `/alert`, nada de eso coincidía con `@vitalia/contracts`, y nadie se enteraba de la divergencia. Además, las IAs que trabajan en el monorepo no tenían el contexto del firmware, y viceversa.

## Decisión

- El firmware pasa a ser el proyecto Nx **`wearable-firmware-poc`**, en `apps/wearable-firmware-poc`. Se importó con `nx import`, que conserva los commits originales.
- **El contrato del monorepo es la fuente de verdad.** El `AGENTS.md` del firmware resume `@vitalia/contracts` y `docs/04-contratos.md` en vez de definir uno propio. Alinear el código pasa al roadmap (Fase 2, F).
- Tags `scope:wearable`, `type:app`, con `implicitDependencies: ["contracts"]`. Así un cambio de contrato marca el firmware como afectado y aparece en `nx graph`.
- Targets `nx:run-commands` que envuelven PlatformIO: `pio-build`, `pio-upload`, `pio-monitor` y `pio-clean`, más los scripts `pnpm fw:*`.
  - Se llaman `pio-*` y no `build`/`test` para que `pnpm affected`, `pnpm build` y `pnpm check` no exijan PlatformIO a quien no trabaja con el firmware.
  - **Sin caché de Nx:** `src/secrets.h` no se versiona, así que Nx no lo puede hashear, y un build cacheado ignoraría credenciales nuevas.
- **CI:** el job `firmware` en `ci.yml` se filtra por rutas (`apps/wearable-firmware-poc/**`, `libs/shared/contracts/**` y el workflow). Instala PlatformIO con caché, compila con `secrets.h.example` y corre `pio run` directo, sin Nx, para no instalar las dependencias de Node en ese job.

## Alternativas consideradas

- **Seguir en un repo aparte**, como el portal cautivo ([ADR 0004](0004-portal-cautivo-fuera-del-monorepo.md)). El firmware recién empieza a integrarse y es el consumidor más sensible del contrato MQTT. Separado, el contrato se duplica a mano y ya había divergido.
- **Copiar los archivos sin historial:** se perdían los sketches de cada hito, que se consultan con `git show <commit>:apps/wearable-firmware-poc/src/main.cpp` (ver `ESTADO.md`).
- **Targets `build`/`test` estándar:** obligaban a todo el equipo y al job principal de CI a tener PlatformIO.

## Consecuencias

- (+) Un solo lugar para el contrato y para su implementación en la API y el firmware. Los cambios de contrato disparan la compilación del firmware en CI.
- (+) Las IAs ven el firmware y la plataforma juntos. El firmware sigue la misma convención `AGENTS.md` + `CLAUDE.md` ([ADR 0008](0008-contexto-ia-agents-md-y-skills.md)).
- (−) El job de firmware tarda un par de minutos cuando corre (toolchain ESP32, con caché).
- (−) La extensión PlatformIO de VS Code espera el `platformio.ini` en la raíz de la carpeta abierta: hay que abrir `apps/wearable-firmware-poc` en una ventana aparte.
- El repo `mordecoi/POC-PTI` queda como histórico. El desarrollo sigue acá.
