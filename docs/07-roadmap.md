# 07 · Roadmap e implementación por fases

> Plan vivo: marcá los checkboxes a medida que avanzan (skill `vitalia-docs`). Las fechas son **tentativas** y se alinean a los hitos de la tesis: **Hito 3 (octubre 2026)**, ecosistema integrado de punta a punta. **Hito 4 (noviembre 2026)**, validación y defensa.
> Responsables: **G** = Gastón (backend Fog) · **T** = Tomás (interfaces) · **F** = Facundo (hardware/red) · **Eq** = equipo.

## Resumen

| Fase | Objetivo                                | Fechas    | Resp.  | Estado                     |
| ---- | --------------------------------------- | --------- | ------ | -------------------------- |
| 0    | Fundaciones del monorepo                | 3 oct     | G      | ✅ Completa                |
| 1    | Núcleo de datos, turnos y auth          | 3–4 oct   | G      | ✅ Completa                |
| 2    | Telemetría MQTT, alertas y tiempo real  | 5–18 oct  | G (+F) | ✅ API · ⏳ OLED (F)       |
| 3    | Backoffice y llamador TV funcionales    | 12–18 oct | G (T)  | ✅ Completa                |
| 4    | Despliegue e integración del software   | 18–31 oct | G      | 4a–4b completas · sigue 4c |
| 5    | Resiliencia, carga y validación         | 1–15 nov  | Eq     | Pendiente                  |
| 6    | Landing, memoria y defensa (**Hito 4**) | nov       | Eq     | Pendiente                  |

```mermaid
gantt
  dateFormat YYYY-MM-DD
  axisFormat %d/%m
  section Backend
  F1 Datos y turnos        :done, f1, 2026-10-03, 2d
  F2 Telemetría y RT       :done, f2, 2026-10-05, 14d
  section Frontend
  F3 Backoffice y TV       :done, f3, 2026-10-12, 7d
  section Equipo
  F4 Integración software :crit, f4, 2026-10-18, 14d
  F5 Validación            :f5, 2026-11-01, 15d
  F6 Cierre y defensa      :f6, 2026-11-15, 10d
```

---

## Fase 0 · Fundaciones ✅

- [x] Workspace Nx 23 (pnpm, preset integrado Angular) — [ADR 0001](adr/0001-monorepo-nx.md)
- [x] `apps/api` NestJS 11: config validada (zod), `/api`, CORS, ValidationPipe, Swagger, `GET /api/health` + tests
- [x] `apps/backoffice` Angular 22 + Material M3 con identidad Vitalia, chequeo de API, vista previa de triaje
- [x] `apps/tv-display` Angular 22: pantalla del llamador (datos de ejemplo)
- [x] `libs/shared/contracts`: health, eventos WS, tópicos MQTT, umbrales y `assessVitals()` + tests
- [x] `libs/shared/design-tokens` (SCSS + TS + assets) y `libs/shared/ui` (logo, tema)
- [x] `docker-compose.yml`: PostgreSQL 16 + Mosquitto 2
- [x] Límites de módulos por tags, ESLint, Prettier, Husky + commitlint, CI con `nx affected`
- [x] Contexto IA: `AGENTS.md` raíz y por proyecto, punteros para cada herramienta, 8 skills del proyecto, skills y MCP de Nx
- [x] Documentación base (`docs/`) y ADRs iniciales

## Fase 1 · Núcleo de datos, turnos y auth (G) ✅

**Objetivo:** que la API persista pacientes y turnos, exponga la fila, el check-in y el llamado, y tenga login del personal.

- [x] ORM decidido: **TypeORM 1.1** ([ADR 0009](adr/0009-orm-typeorm.md); Prisma rechazado, [ADR 0005](adr/0005-orm-prisma.md))
- [x] Módulo `database` (TypeORM + PostgreSQL) y check de la base en `/api/health`
- [x] Esquema inicial + migración: `staff_users`, `service_areas`, `consulting_rooms`, `patients`, `tickets`, `wearables`, `telemetry_readings`, `alerts` ([08-modelo-datos.md](08-modelo-datos.md))
- [x] Seed determinístico e idempotente con datos simulados: servicios, consultorios, personal, wearables y 14 turnos del día
- [x] Contratos en `@vitalia/contracts`: auth/roles, catálogo, turnos (estados, transiciones, orden de la fila, código), check-in
- [x] Módulo `tickets`: fila ordenada, detalle, vista pública con posición y espera, llamado, cambio de estado, triaje manual
- [x] Módulo `check-in` público, idempotente por DNI y con rate limit (10/min)
- [x] Módulo `auth`: login JWT (8 h), roles (`ADMIN`, `NURSE`, `DOCTOR`, `RECEPTION`), guards globales (`@Public`, `@Roles`), login limitado a 5/min
- [x] Módulo `catalog`: servicios (público) y consultorios
- [x] Skill `vitalia-database` + `pnpm ai:sync`
- [x] Tests: 22 en la API (unitarios + integración contra PostgreSQL en CI) y 11 en contracts
- [x] REST de turnos < 50 ms: **p50 ≈ 5 ms, p95 ≈ 9 ms** en local

**Terminado ✅:** desde Swagger se puede loguear, hacer check-in, ver la fila y llamar un turno, y todo queda persistido.

## Fase 2 · Telemetría MQTT, alertas y tiempo real (G + F)

- [x] Firmware del wearable migrado al monorepo con su historial: `apps/wearable-firmware-poc`, targets `pio-*`, job `firmware` en CI ([ADR 0010](adr/0010-firmware-del-wearable-en-el-monorepo.md)) (F)
- [x] Firmware reestructurado (`lib/` telemetry, fall_detection, sensors, net, ui + `config.h`) con tests native en CI (`pnpm fw:test`) (F)
- [x] Firmware: arma `TelemetryReading` cada 3 s (`seq` por arranque en NVS, `ts` en ms) y la expone por HTTP `/data` (etapa previa a la publicación por MQTT del ítem siguiente) (F)
- [x] Firmware: publicar `TelemetryReading` cifrada por MQTT (con `seq` y `ts` en ms), reemplazando el payload del POC (`device_id`, `bpm`, `temp_c`, `event`) (F)
- [x] Firmware: MQTT con ESP-MQTT contra Mosquitto, QoS 1 y outbox (Hito 6b, [ADR 0012](adr/0012-esp-mqtt-en-el-firmware.md)) — falta probarlo en la placa (F)
- [x] Código de wearable `wb-<NN>-<mac>` en contracts, seed y firmware ([ADR 0011](adr/0011-identificador-del-wearable.md)) (F)
- [x] Vectores AES-256-GCM compartidos: `GCM_TEST_VECTORS` en contracts → `gcm_vectors.h` del firmware (`pnpm fw:codegen`, check en CI) (F)
- [x] Firmware: hora por NTP (`configTime` con `NTP_SERVER`); en desarrollo, NTP público (red única con internet) (F)
- [x] `pnpm fw:mqtt-check`: descifra y valida la telemetría contra el contrato (referencia para el módulo `telemetry`) (F)
- [x] Firmware: sobre AES-256-GCM `{ v, iv, ct, tag }` en `lib/crypto` + test Unity que pase los vectores de `test/fixtures/gcm_vectors.h` (Hito 7) (F)
- [ ] Firmware: suscripción a `.../cmd` y `SHOW_TICKET` en el OLED (F)
- [x] Firmware: detección de caídas en tres fases (caída libre → impacto > 2,8 g → inmovilidad) en `lib/fall_detection`, con tests native; la caída confirmada se publica sin esperar el ciclo de 3 s (Hito 8) — falta calibrar con caídas controladas en la placa (F)
- [x] Firmware: `contracts.h` generado (como `include/vitalia_contracts.h`, `pnpm fw:codegen`) desde `@vitalia/contracts` (tópicos y umbrales) con un check en CI de que no quedó desactualizado; hoy `implicitDependencies` solo recompila, no detecta divergencias (F)

- [x] Emitir eventos de dominio desde `tickets`: check-in, llamado, estado y triaje (G)
- [x] Módulo `realtime`: gateway Socket.IO con salas `staff` (JWT en el handshake) / `tv` / `patient:<id>`, `realtime:ready` y `realtime:error` — [ADR 0007](adr/0007-tiempo-real-socket-io.md) (G)
- [x] `ticket:called` y `queue:updated` emitidos desde `tickets`; al finalizar o cancelar un turno se libera la pulsera (G)
- [x] Módulo `mqtt` (cliente único, reconexión, QoS 1) y módulo `telemetry`: suscripción `hospital/+/wearable/+/data` (G)
- [x] Descifrado AES-256-GCM + tests con `GCM_TEST_VECTORS` (`@vitalia/contracts/testing`) + descartar si el `wearableId` descifrado no coincide con el del tópico — [ADR 0006](adr/0006-cifrado-aes-256-gcm.md) (G; F: mismos vectores en el firmware)
- [x] Validación (zod), deduplicación por `seq` (memoria + índice único), pulseras no dadas de alta descartadas, `vitalsFindings()`/`assessVitals()`, persistencia en segundo plano después de emitir; el triaje del turno solo sube (G)
- [x] Módulo `alerts`: una alerta por hallazgo CRÍTICO sin repetir la activa del mismo tipo, `alert:emergency` antes de persistir, `GET /api/alerts`, `POST /api/alerts/:id/ack` → `alert:acknowledged` (G)
- [x] Módulo `wearables`: alta validando formato y **número** sin repetir (ADR 0011), asignar/liberar, última lectura, `online`, sala del tópico y `SHOW_TICKET` a `.../cmd` al llamar (G)
- [x] Migración `Fase2Iomt`: `seq` a `bigint` (con el arranque en los bits altos superaba int32), índice único `(wearable_id, seq)`, `wearables.last_room` (G)
- [x] `tools/wearable-simulator` (`pnpm sim:wearables`): N pulseras simuladas, anomalías inyectables (caída, hipoxia, taquicardia…), eventos de prueba (reinicio, duplicado, tag alterado, tópico ajeno) y cifrado real. Probado contra Mosquitto con `fw:mqtt-check` y con 50 pulseras (F)
- [x] Check de MQTT en `/api/health` (`degraded` si no está configurado o no conecta: los turnos siguen) (G)
- [x] Test de integración de punta a punta con broker en proceso (aedes) y Socket.IO real: caída → `alert:emergency`, dedupe, spoof, tag alterado, `ack`, llamado → TV/paciente/`SHOW_TICKET`, alta y asignación de pulseras (G)

**Terminado ✅ (lado API, 18/10):** con `pnpm sim:wearables --inject=fall:3@4` y la API corriendo, la caída llega a la sala `staff` como `alert:emergency` **~8 ms** después del `ts` del wearable y queda persistida; el test de integración mide ~15 ms entre publicar y recibir (objetivo < 500 ms). El simulador confirma el descarte de `tamper` y `spoof` y la deduplicación de `duplicate`. Queda del lado del firmware mostrar `SHOW_TICKET` en el OLED (F).

## Fase 3 · Backoffice y llamador TV ✅

> La terminó el backend (G) el 18/10, adelantando la parte de Tomás para llegar al Hito 3 con todo integrado.

- [x] Login del personal + guards (`authGuard`, `guestGuard`) + interceptor JWT (401 → login con "sesión vencida") (3a)
- [x] Layout con navegación (Triaje · Turnos · Alertas · Pulseras), estado de la conexión en vivo, sonido, usuario y estado del gateway (3a)
- [x] Servicio `realtime` (socket.io-client): JWT en el handshake, `realtime:ready`/`realtime:error`, reconexión y re-sincronización al reconectar (3a)
- [x] **Fila de triaje** priorizada en vivo (nivel → hora), con signos vitales de la pulsera, motivos, espera y filtro por servicio (3b)
- [x] **Panel de alertas**: aviso rojo intermitente + alarma Web Audio, reconocer, minimizar, historial con quién reconoció (RF-O4) (3b)
- [x] **Llamar turno** desde la fila (diálogo de consultorio) → TV, portal y OLED; acciones de estado y triaje manual según rol y `canTransition` (3c)
- [x] Página **Turnos**: todos los del día, filtro por estado y búsqueda (3c)
- [x] API: `GET /api/tickets/recent-calls` (público) para que la TV se ponga al día al arrancar o reconectar (3c)
- [x] TV: `ticket:called` en vivo, historial de 5, destello, campanita + voz (`speechSynthesis`), reconexión y último estado guardado (3c)
- [x] Vista de pulseras: conexión en vivo, sala, turno, última lectura, alta, asignar y liberar (3d). La batería no está en el contrato todavía (ver firmware)
- [x] Responsivo de 360 px a escritorio, modo claro/oscuro, 26 tests en el Backoffice y 8 en la TV (3d)
- [x] `API_PORT` en lugar de `PORT`: el dev-server de Angular tomaba `PORT=3000` del `.env` y Backoffice/TV no levantaban en 4200/4300

**Terminado ✅ (18/10):** probado en Chromium con la API, el broker y el simulador corriendo. Una caída simulada abre el aviso rojo en el Backoffice (~3 s desde lanzar el simulador, que tarda en arrancar; la API la emite en milisegundos) y un llamado aparece en la TV **113 ms** después del click en "Llamar".

## Fase 4 · Despliegue e integración del software (G)

> Alcance acordado el 18/10: desarrollo del monorepo y validación con simuladores. Portal cautivo, router, VLANs, walled garden, servicio NTP de la red, montaje y calibración física quedan fuera de esta fase de desarrollo. El firmware entra como código, compilación y tests sin placa. La demo física completa del Hito 3 conserva esas dependencias externas; no se las acredita con una prueba de software.

### 4a · Despliegue reproducible del gateway — completo (18/10)

- [x] Imágenes multi-stage: API con dependencias de producción, Backoffice y TV estáticos con Nginx; proxies `/api` y `/socket.io`.
- [x] Compose independiente del entorno dev, migraciones al arrancar, volúmenes y healthchecks.
- [x] Configuración local con credenciales aleatorias, sin sobrescribir secretos existentes; seed simulado explícito.
- [x] Smoke de ambos orígenes: HTML, rutas SPA, health, PostgreSQL, MQTT y Socket.IO (WebSocket y polling); guía y job CI definido.

**Verificado localmente (18/10):** imágenes construidas desde cero, migraciones aplicadas y seed dentro de la imagen final (3 servicios, 5 consultorios, 5 usuarios, 8 pulseras y 14 turnos). Smoke OK en `localhost:8080` y `localhost:8081`; 2 tests del inicializador y `pnpm affected` en verde (7 proyectos, 16 tareas). El job CI está configurado; su ejecución remota no se acredita en esta validación local.

También se verificó parada y recreación del stack sin borrar volúmenes: usuarios, IDs de turnos y credenciales se conservan; login y smoke pasan después del segundo arranque.

### 4b · Seguridad MQTT — completo (18/10)

- [x] Usuarios y ACL por wearable, usuario propio de la API y cuenta de health restringida, con aprovisionamiento reproducible sin versionar secretos; altas, rotación y bajas explícitas ([ADR 0014](adr/0014-identidades-y-acl-mqtt.md)).
- [x] Pruebas contra Mosquitto real: anónimos y contraseña incorrecta rechazados, escrituras cruzadas denegadas con PUBACK `0x87` y aislamiento de entregas aun con filtros amplios; simulador con credenciales por pulsera (`--gateway`).

**Verificado localmente (18/10):** actualización del stack 4a sin borrar volúmenes, broker autenticado y health OK; se conservan los 14 turnos del seed. Dos pulseras enviaron 7 lecturas cifradas, confirmadas por QoS 1 y persistidas en PostgreSQL. Smoke de Backoffice/TV y Socket.IO en verde. Los tests del aprovisionador cubren idempotencia, conservación de secretos, altas y revocación; CI incorpora el check MQTT real. El transporte sigue siendo TCP en loopback, sin TLS ni validación física o de red.

Segundo arranque verificado: archivos de credenciales idénticos, MQTT y smoke otra vez en verde. `pnpm affected` pasó sus 16 tareas de lint/test/build en 7 proyectos; los 7 tests operativos de inicialización, entorno y aprovisionamiento también pasaron. La ejecución remota del job CI queda pendiente; este cierre acredita las comprobaciones locales.

### 4c · Comandos en el firmware

- [ ] Suscripción a `.../cmd`, validación de `SHOW_TICKET`, estado del llamado en OLED y resuscripción al reconectar.
- [ ] Tests native de parser/estado y compilación sin exigir placa, flasheo ni calibración. MAX30102 no bloquea este cierre: el simulador aporta `hr` y `spo2`.

### 4d · Pruebas integradas de software

- [ ] Check-in por API → asignación de pulsera simulada → telemetría cifrada → alerta y reconocimiento en Backoffice → llamado en TV y recepción de `SHOW_TICKET` por un cliente de prueba.
- [ ] Verificar resincronización tras reconectar sobre el despliegue Docker, aprovechando la lógica de Fase 3.

### 4e · Operación y demo

- [ ] Guion E2E, configuración, datos simulados, arranque/parada y recuperación documentados; checks Nx y demo reproducibles.

**Terminado (software) cuando:** desde una copia limpia se levanta el gateway Docker y se completa el recorrido de 4d con checks en verde, sin depender del portal, router ni hardware físico. Guía: [09-despliegue-gateway.md](09-despliegue-gateway.md).

## Fase 5 · Resiliencia, carga y validación (Eq)

- [ ] Módulo `sync`: outbox local → réplica a la nube al volver la WAN (RF-O6, capa Cloud)
- [ ] Firmware: buffer propio para cortes del broker de más de 30 s (el outbox de ESP-MQTT descarta a los 30 s, ADR 0012) (F)
- [ ] Prueba de corte de WAN durante 24 h (RNF-O2)
- [ ] Carga: 50 pulseras cada 3 s (simulador) y 0 % de pérdida con QoS 1
- [ ] Medición de latencias (alerta < 500 ms, REST < 50 ms, llamado < 100 ms) con reporte
- [ ] Estrés con > 10.000 registros simulados en la consola
- [ ] Escaneo de puertos en la red guest (aislamiento al 100 %)
- [ ] Resultados volcados al capítulo 12 de la tesis

## Fase 6 · Cierre y defensa — Hito 4 (Eq)

- [ ] Landing page de Vitalia (nueva app en el monorepo, con la misma identidad)
- [ ] Documentación final y actualización de la tesis (capítulos 12–14, "Diferencias con la tesis")
- [ ] Video y demo, presentación para la defensa

## Backlog opcional

- App del paciente en Flutter (APK + PWA), según la tesis
- RF-D1 notificaciones push · RF-D3 reportes PDF · RNF-D2 i18n (es/en) · RF-D2 mesh
- Extraer los módulos de la API a libs `libs/api/<dominio>` si la API crece
