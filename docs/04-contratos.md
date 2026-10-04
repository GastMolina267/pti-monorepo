# 04 · Contratos

Fuente de verdad en código: [`libs/shared/contracts`](../libs/shared/contracts) (`@vitalia/contracts`). Este documento lo resume para quien no lee TypeScript (firmware, portal, tesis). Si cambia algo, se actualizan **los dos**.

## REST (`/api`)

Swagger interactivo: `http://localhost:3000/api/docs`.

| Método | Ruta                        | Descripción                                          | Estado    |
| ------ | --------------------------- | ---------------------------------------------------- | --------- |
| GET    | `/api/health`               | Estado del gateway (`HealthResponse`)                | ✅ Fase 0 |
| POST   | `/api/auth/login`           | Login del personal → JWT                             | Fase 1    |
| POST   | `/api/check-in`             | Check-in desde el portal o kiosk → turno             | Fase 1    |
| GET    | `/api/tickets?status=`      | Fila de espera                                       | Fase 1    |
| GET    | `/api/tickets/:id`          | Estado de un turno (portal del paciente)             | Fase 1    |
| POST   | `/api/tickets/:id/call`     | Llamar un turno a consultorio                        | Fase 1    |
| PATCH  | `/api/tickets/:id`          | Cambiar el estado (en atención, finalizado, ausente) | Fase 1    |
| GET    | `/api/wearables`            | Wearables y su última lectura                        | Fase 2    |
| POST   | `/api/wearables/:id/assign` | Asignar un wearable a un turno                       | Fase 2    |
| GET    | `/api/alerts?active=true`   | Alertas activas                                      | Fase 2    |
| POST   | `/api/alerts/:id/ack`       | Reconocer una alerta                                 | Fase 2    |

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "vitalia-api",
  "version": "0.1.0",
  "environment": "development",
  "uptimeSeconds": 42,
  "timestamp": "2026-10-03T22:00:00.000Z",
  "checks": [{ "name": "process", "status": "ok" }]
}
```

## Tiempo real (Socket.IO, path `/socket.io`)

Constantes: `REALTIME_EVENTS`, `REALTIME_ROOMS`.

| Evento               | Salas                               | Payload                                                                                                  | Fase |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ---- |
| `ticket:called`      | `tv`, `staff`, `patient:<ticketId>` | `TicketCalledEvent { ticketId, ticketCode, consultingRoom, professionalName?, calledAt }`                | 2–3  |
| `queue:updated`      | `staff`, `tv`                       | resumen de la fila                                                                                       | 2–3  |
| `telemetry:reading`  | `staff`                             | `TelemetryReading` + nivel                                                                               | 2    |
| `alert:emergency`    | `staff`                             | `AlertEmergencyEvent { alertId, wearableId, patientId?, ticketCode?, kind, level, message, detectedAt }` | 2    |
| `alert:acknowledged` | `staff`                             | `{ alertId, by, at }`                                                                                    | 2    |

Los signos vitales **solo** se emiten a la sala `staff`.

## MQTT (Mosquitto, puerto 1883, QoS 1)

| Tópico                               | Dirección             | Contenido                              |
| ------------------------------------ | --------------------- | -------------------------------------- |
| `hospital/<sala>/wearable/<id>/data` | wearable → gateway    | Sobre cifrado con la lectura           |
| `hospital/<sala>/wearable/<id>/cmd`  | gateway → wearable    | Comando (ej. mostrar turno en el OLED) |
| `hospital/+/wearable/+/data`         | suscripción de la API | —                                      |

### Sobre cifrado (`EncryptedEnvelope`)

```json
{ "v": 1, "iv": "<12 bytes base64>", "ct": "<base64>", "tag": "<16 bytes base64>" }
```

- Algoritmo **AES-256-GCM**. Clave de 32 bytes compartida (`TELEMETRY_AES_KEY`, 64 hex). IV aleatorio por mensaje ([ADR 0006](adr/0006-cifrado-aes-256-gcm.md)).
- Si el tag no valida, el mensaje se descarta.

### Lectura en claro (`TelemetryReading`)

```json
{
  "wearableId": "w-07",
  "seq": 1532,
  "ts": 1791065563577,
  "hr": 78,
  "spo2": 98,
  "temp": 36.6,
  "accPeakG": 1.02,
  "fall": false
}
```

| Campo      | Unidad   | Notas                                                         |
| ---------- | -------- | ------------------------------------------------------------- |
| `seq`      | —        | Contador monotónico; la API deduplica por `(wearableId, seq)` |
| `ts`       | ms epoch | Hora del wearable                                             |
| `hr`       | BPM      |                                                               |
| `spo2`     | %        |                                                               |
| `temp`     | °C       | Ya compensada a temperatura clínica                           |
| `accPeakG` | g        | Pico del intervalo                                            |
| `fall`     | bool     | `true` si el firmware detectó una caída                       |

### Comando al wearable (propuesta, Fase 2)

```json
{ "type": "SHOW_TICKET", "ticketCode": "A-024", "consultingRoom": "Cons. 4" }
```

## Portal cautivo ↔ API (Fase 4)

El portal (`pti-captive-portal`) hoy espera `/auth/*`. En la Fase 4 se alinea con este contrato (check-in y estado del turno) y su `VITE_BASE_URL` apunta a la API del gateway.
