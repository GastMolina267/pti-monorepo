# 04 · Contratos

Fuente de verdad en código: [`libs/shared/contracts`](../libs/shared/contracts) (`@vitalia/contracts`). Este documento lo resume para quien no lee TypeScript (firmware, portal, tesis). Si cambia algo, se actualizan **los dos**.

## REST (`/api`)

Swagger interactivo: `http://localhost:3000/api/docs`.

Autenticación: header `Authorization: Bearer <accessToken>` en todo endpoint salvo los marcados como **público**. Roles: `ADMIN`, `NURSE`, `DOCTOR`, `RECEPTION`.

| Método | Ruta                                | Acceso                       | Descripción                                                                             | Estado |
| ------ | ----------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- | ------ |
| GET    | `/api/health`                       | público                      | Estado del gateway, PostgreSQL y MQTT (`HealthResponse`)                                | ✅ F2  |
| POST   | `/api/auth/login`                   | público (5/min por IP)       | Login del personal → `LoginResponse` (JWT de 8 h)                                       | ✅ F1  |
| GET    | `/api/auth/me`                      | staff                        | Usuario autenticado (`StaffUser`)                                                       | ✅ F1  |
| GET    | `/api/services`                     | público                      | Servicios de atención (`ServiceArea[]`) para elegir en el check-in                      | ✅ F1  |
| GET    | `/api/consulting-rooms`             | staff                        | Consultorios activos (`ConsultingRoom[]`)                                               | ✅ F1  |
| POST   | `/api/check-in`                     | público (10/min por IP)      | Check-in (`CheckInRequest`) → `PublicTicket`. Idempotente por DNI                       | ✅ F1  |
| GET    | `/api/tickets?status=&serviceCode=` | staff                        | Fila del día (por defecto, turnos abiertos), ordenada por triaje y llegada (`Ticket[]`) | ✅ F1  |
| GET    | `/api/tickets/:id`                  | staff                        | Detalle de un turno (`Ticket`)                                                          | ✅ F1  |
| GET    | `/api/tickets/:id/public`           | público                      | Estado para el paciente (`PublicTicket`: posición y espera estimada)                    | ✅ F1  |
| GET    | `/api/tickets/recent-calls`         | público                      | Últimos 6 llamados del día para la TV (`RecentCallsResponse`, sin datos clínicos)       | ✅ F3  |
| POST   | `/api/tickets/:id/call`             | `DOCTOR` · `NURSE` · `ADMIN` | Llamar a un consultorio (`CallTicketRequest`)                                           | ✅ F1  |
| PATCH  | `/api/tickets/:id/status`           | staff                        | Cambiar el estado (`UpdateTicketStatusRequest`) según las transiciones permitidas       | ✅ F1  |
| PATCH  | `/api/tickets/:id/triage`           | `NURSE` · `DOCTOR` · `ADMIN` | Triaje manual (`UpdateTriageRequest`)                                                   | ✅ F1  |
| GET    | `/api/wearables`                    | staff                        | Pulseras con turno, conexión (`online`), sala y última lectura (`Wearable[]`)           | ✅ F2  |
| GET    | `/api/wearables/:id`                | staff                        | Detalle de una pulsera (`Wearable`)                                                     | ✅ F2  |
| POST   | `/api/wearables`                    | `ADMIN` · `NURSE`            | Alta (`CreateWearableRequest`): código `wb-<NN>-<mac>` y número sin repetir → 409       | ✅ F2  |
| POST   | `/api/wearables/:id/assign`         | staff                        | Asignar a un turno abierto (`AssignWearableRequest`). Si ya lo llamaron, va al OLED     | ✅ F2  |
| POST   | `/api/wearables/:id/release`        | staff                        | Liberar la pulsera (también se libera sola al finalizar o cancelar el turno)            | ✅ F2  |
| GET    | `/api/alerts?active=true`           | staff                        | Alertas activas (`active=false`: las últimas 100 de cualquier estado) (`Alert[]`)       | ✅ F2  |
| POST   | `/api/alerts/:id/ack`               | staff                        | Reconocer una alerta → `Alert` y `alert:acknowledged`. Ya reconocida → 409              | ✅ F2  |

### Ciclo de vida del turno

```mermaid
stateDiagram-v2
  [*] --> WAITING: check-in
  WAITING --> CALLED: llamar (POST /call)
  WAITING --> CANCELLED
  CALLED --> CALLED: volver a llamar
  CALLED --> IN_PROGRESS
  CALLED --> WAITING: devolver a la fila
  CALLED --> NO_SHOW: ausente
  NO_SHOW --> WAITING
  IN_PROGRESS --> DONE
  DONE --> [*]
  CANCELLED --> [*]
```

Una transición inválida responde **409 Conflict**. La regla está en `TICKET_TRANSITIONS` / `canTransition()` de `@vitalia/contracts`.

### Errores

Formato estándar de NestJS: `{ "statusCode": 400, "message": "…" | ["…"], "error": "Bad Request" }`. Los mensajes de validación están en español para mostrarlos tal cual en el portal o el Backoffice. 401: falta el token o es inválido · 403: rol sin permiso · 404: no existe · 409: transición inválida · 429: demasiados intentos.

### Ejemplos

```http
POST /api/check-in
{ "firstName": "Lucía", "lastName": "Gómez", "documentNumber": "30123456",
  "serviceCode": "CLINICA", "source": "CAPTIVE_PORTAL", "reason": "Fiebre" }

201 → { "id": "…", "code": "A-009", "status": "WAITING", "serviceName": "Clínica Médica",
        "consultingRoomName": null, "position": 4, "estimatedWaitMinutes": 48,
        "checkedInAt": "2026-10-03T22:35:02.559Z", "calledAt": null }
```

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "vitalia-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 42,
  "timestamp": "2026-10-03T22:00:00.000Z",
  "checks": [
    { "name": "process", "status": "ok" },
    { "name": "database", "status": "ok" },
    { "name": "mqtt", "status": "ok" }
  ]
}
```

- `database` caída → `down`.
- `mqtt` sin `MQTT_URL`, sin conexión o sin `TELEMETRY_AES_KEY` → `degraded` con `detail`: los turnos siguen funcionando, pero no entran lecturas ni alertas.

## Tiempo real (Socket.IO, path `/socket.io`)

Constantes: `REALTIME_EVENTS`, `REALTIME_ROOMS`, `REALTIME_READY_EVENT`, `REALTIME_ERROR_EVENT`.

### Conexión (`RealtimeHandshakeAuth`)

La sala se elige con el `auth` del handshake:

```ts
io({ path: '/socket.io', auth: { token: accessToken } }); // personal → sala staff
io({ path: '/socket.io', auth: { role: 'tv' } }); // pantalla llamadora → sala tv
io({ path: '/socket.io', auth: { ticketId } }); // paciente → sala patient:<ticketId>
```

- Al unirse, el servidor emite `realtime:ready` `{ room }`. Recién ahí empiezan a llegar eventos.
- Un token inválido o un `auth` sin ninguno de esos campos recibe `realtime:error` `{ message }` y se desconecta.
- CORS: los mismos orígenes que la API REST (`CORS_ORIGINS`).

### Eventos

| Evento               | Salas                               | Payload                                                                                                              | Estado |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| `ticket:called`      | `tv`, `staff`, `patient:<ticketId>` | `TicketCalledEvent { ticketId, ticketCode, consultingRoom, professionalName?, calledAt }`                            | ✅ F2  |
| `queue:updated`      | `staff`, `tv`                       | `QueueUpdatedEvent { change, ticketId, ticketCode, serviceCode, status, waitingCount, at }`: aviso para re-consultar | ✅ F2  |
| `telemetry:reading`  | `staff`                             | `TelemetryReadingEvent { wearableId, ticketId, ticketCode, reading, assessment, receivedAt }`                        | ✅ F2  |
| `alert:emergency`    | `staff`                             | `AlertEmergencyEvent { alertId, wearableId, ticketId?, patientId?, ticketCode?, kind, level, message, detectedAt }`  | ✅ F2  |
| `alert:acknowledged` | `staff`                             | `AlertAcknowledgedEvent { alertId, by: { id, fullName }, at }`                                                       | ✅ F2  |

- Los signos vitales **solo** se emiten a la sala `staff`. `queue:updated` no lleva triaje ni datos del paciente (lo ve la TV).
- `change` de `queue:updated`: `CHECK_IN`, `CALLED`, `STATUS` o `TRIAGE` (manual o escalado por la telemetría).
- `detectedAt` de una alerta es la hora del wearable (`reading.ts`): la latencia de punta a punta se mide contra ese valor.

### Ingesta y alertas

1. Sobre → AES-256-GCM → validación → `wearableId` = `<id>` del tópico → pulsera dada de alta → deduplicación por `seq`.
2. `vitalsFindings()` (contracts) da los hallazgos con su tipo; `assessVitals()` los resume en nivel y motivos.
3. Se emite `telemetry:reading` y, por cada hallazgo **CRÍTICO**, `alert:emergency`, **antes** de escribir en la base.
4. Se persisten la lectura (`ON CONFLICT DO NOTHING`), la alerta, `last_seen_at`/`last_room` de la pulsera y, si corresponde, el triaje del turno.

- Una alerta del mismo tipo (`kind`) para la misma pulsera no se repite mientras siga `ACTIVE`. Al reconocerla, el próximo hallazgo abre una nueva.
- El triaje del turno **solo sube** por la telemetría. Bajarlo es decisión del personal (`PATCH /api/tickets/:id/triage`).
- Se descartan, con un warning en el log (sin el contenido): tag inválido, JSON o campos fuera del contrato, rangos imposibles, `wearableId` distinto del tópico y códigos que no existen en `wearables`.

## MQTT (Mosquitto, puerto 1883, QoS 1)

| Tópico                               | Dirección             | Contenido                              |
| ------------------------------------ | --------------------- | -------------------------------------- |
| `hospital/<sala>/wearable/<id>/data` | wearable → gateway    | Sobre cifrado con la lectura           |
| `hospital/<sala>/wearable/<id>/cmd`  | gateway → wearable    | Comando (ej. mostrar turno en el OLED) |
| `hospital/+/wearable/+/data`         | suscripción de la API | —                                      |

### Identificador del wearable

`<id>` = `wearableId` = `wearables.code` = **`wb-<NN>-<mac>`**, por ejemplo `wb-07-24d7cc` ([ADR 0011](adr/0011-identificador-del-wearable.md)).

- `NN`: número físico de la pulsera, de 01 a 99. En el firmware es `WEARABLE_NUMBER`, en `secrets.h`.
- `mac`: últimos 3 bytes de la MAC Wi-Fi, en hex minúscula.
- En código: `WEARABLE_CODE_PATTERN`, `formatWearableCode()` y `parseWearableCode()` de `@vitalia/contracts`.
- Fase 4: el código también es el usuario de Mosquitto. Su contraseña se carga a mano en el firmware.

### Sobre cifrado (`EncryptedEnvelope`)

```json
{ "v": 1, "iv": "<12 bytes base64>", "ct": "<base64>", "tag": "<16 bytes base64>" }
```

- Algoritmo **AES-256-GCM**. Clave de 32 bytes compartida (`TELEMETRY_AES_KEY`, 64 hex). IV aleatorio por mensaje ([ADR 0006](adr/0006-cifrado-aes-256-gcm.md)).
- Si el tag no valida, el mensaje se descarta.
- **Sin AAD**: el campo `v` viaja en claro y no forma parte de la autenticación.
- **El `wearableId` descifrado tiene que coincidir con el `<id>` del tópico**; si no, el mensaje se descarta. El sobre no lleva AAD y la clave es una sola para todas las pulseras: sin este chequeo, un sobre válido de una pulsera publicado en el tópico de otra pasaría como bueno. A futuro (`v: 2`), el tópico puede ir como AAD.

**Implementación de referencia del descifrado y la validación:** `tools/scripts/mqtt-check.ts` (`pnpm fw:mqtt-check`). El tópico `<…>/data/plain` que el firmware puede publicar en desarrollo (`MQTT_DEBUG_PLAINTEXT`) **no es parte del contrato**.

#### Vectores de prueba compartidos

`GCM_TEST_VECTORS` de `@vitalia/contracts` (`telemetry/gcm-test-vectors.ts`) es la fuente única de vectores AES-256-GCM:

| Vector                    | Qué prueba                                                         |
| ------------------------- | ------------------------------------------------------------------ |
| `nist_tc15`               | Vector oficial del NIST (AES-256, IV de 96 bits, sin AAD)          |
| `vitalia_reading`         | Un `TelemetryReading` de `wb-01-24d7cc`, también en forma de sobre |
| `vitalia_reading_bad_tag` | Tag alterado: el descifrado **tiene que fallar**                   |

- El spec de contracts los verifica con `node:crypto`.
- Se importan desde **`@vitalia/contracts/testing`**, no desde el barrel principal, así Backoffice, TV y portal no los ven.
- La API los usa en los tests de descifrado del módulo `telemetry`.
- El firmware los recibe en `apps/wearable-firmware-poc/test/fixtures/gcm_vectors.h`, generado con `pnpm fw:codegen`. La CI corre `pnpm fw:codegen --check` para que no quede desactualizado.
- La clave de los vectores (`00…1f`) es solo para tests: nunca usarla como `TELEMETRY_AES_KEY`.

### Lectura en claro (`TelemetryReading`)

```json
{
  "wearableId": "wb-07-24d7cc",
  "seq": 1532,
  "ts": 1791065563577,
  "hr": 78,
  "spo2": 98,
  "temp": 36.6,
  "accPeakG": 1.02,
  "fall": false
}
```

| Campo      | Unidad   | Notas                                                                                     |
| ---------- | -------- | ----------------------------------------------------------------------------------------- |
| `seq`      | —        | Monotónico, también entre reinicios (ver abajo); la API deduplica por `(wearableId, seq)` |
| `ts`       | ms epoch | Hora del wearable (NTP; ver nota de red en 01-arquitectura)                               |
| `hr`       | BPM      |                                                                                           |
| `spo2`     | %        |                                                                                           |
| `temp`     | °C       | Ya compensada a temperatura clínica                                                       |
| `accPeakG` | g        | Pico del intervalo                                                                        |
| `fall`     | bool     | `true` si el firmware detectó una caída                                                   |

#### `seq` entre reinicios

`seq = arranque × 2^24 + contador` (`composeSeq()` / `splitSeq()` de `@vitalia/contracts`, `SEQ_BOOT_SHIFT = 24`).

- El wearable guarda un contador de **arranques** en su flash (NVS): una escritura por boot.
- El **contador** de mensajes vuelve a 0 en cada arranque. Así, después de reiniciar, `seq` salta al bloque siguiente y sigue creciendo. Si arrancara de 0, la deduplicación descartaría las lecturas nuevas.
- La API puede usar `splitSeq(seq).boot` para detectar reinicios. Un salto de `counter` dentro del mismo `boot` indica mensajes perdidos.
- El simulador de wearables tiene que armar `seq` igual.

#### Constantes para el firmware

Lo que el firmware necesita del contrato (tópicos, `MQTT_QOS`, `ENVELOPE_VERSION`, `TELEMETRY_CIPHER`, `SEQ_BOOT_SHIFT`, el rango del número de wearable y `CLINICAL_THRESHOLDS`) se genera en `apps/wearable-firmware-poc/include/vitalia_contracts.h` con `pnpm fw:codegen`. La CI verifica que esté al día.

### Comando al wearable (`WearableCommand`)

```json
{ "type": "SHOW_TICKET", "ticketCode": "A-024", "consultingRoom": "Consultorio 4" }
```

- La API lo publica en `hospital/<sala>/wearable/<id>/cmd` con QoS 1 y sin retain al llamar el turno que tiene la pulsera, o al asignar la pulsera a un turno ya llamado.
- `<sala>` es la de la última lectura recibida (`wearables.last_room`). Si nunca publicó, se usa `DEFAULT_WEARABLE_ROOM` (`sala1`).
- Va **en claro**: no lleva signos vitales ni datos personales, solo lo que ya muestra la TV. En la Fase 4 la ACL de Mosquitto limita quién publica en `cmd`.
- Si no hay conexión con el broker, el llamado sigue igual (el OLED no se entera).

## Portal cautivo ↔ API (Fase 4)

El portal (`pti-captive-portal`) hoy espera `/auth/*`. En la Fase 4 se alinea con este contrato: `GET /api/services`, `POST /api/check-in` y polling o socket de `GET /api/tickets/:id/public`. Su `VITE_BASE_URL` apunta a la API del gateway (CORS ya incluye `http://localhost:5173`).
