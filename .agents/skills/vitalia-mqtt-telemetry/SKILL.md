---
name: vitalia-mqtt-telemetry
description: Ingesta de telemetría IoMT por MQTT en la API - conexión a Mosquitto, suscripción a hospital/+/wearable/+/data, descifrado AES-256-GCM, validación del payload, clasificación con assessVitals, persistencia, generación de alertas y comandos al wearable; también el simulador de wearables para pruebas de carga. Usala para todo lo relacionado con wearables, MQTT, cifrado o alertas biométricas.
---

# Telemetría MQTT (wearable → Edge Gateway)

## Contrato (en `@vitalia/contracts`)

- Tópico de datos: `MQTT_TOPICS.wearableData(room, id)` → `hospital/<sala>/wearable/<id>/data`. Suscripción: `MQTT_TOPICS.allWearableData`.
- Comandos al wearable (OLED): `MQTT_TOPICS.wearableCommand(room, id)` → `.../cmd`, payload `WearableCommand` (hoy `SHOW_TICKET { ticketCode, consultingRoom }`), JSON en claro, QoS 1, sin retain. Sala = `wearables.last_room` o `DEFAULT_WEARABLE_ROOM`.
- QoS: `MQTT_QOS = 1`.
- Payload publicado: `EncryptedEnvelope { v: 1, iv, ct, tag }` (base64). Descifrado: `TelemetryReading { wearableId, seq, ts, hr?, spo2?, temp?, accPeakG?, fall? }`.
- `seq = arranque × 2^24 + contador` (`composeSeq`/`splitSeq`): salta de bloque cuando el wearable reinicia. Deduplicá por `(wearableId, seq)` y usá `splitSeq` para distinguir un reinicio de una pérdida. El simulador arma `seq` igual.
- Identificador `<id>` = `wearableId` = `wearables.code` = `wb-<NN>-<mac>` (ej. `wb-07-24d7cc`, ADR 0011). Validalo con `WEARABLE_CODE_PATTERN` / `parseWearableCode()` de contracts y descartá los mensajes cuyo código no exista en `wearables`.
- **Referencia:** `tools/scripts/mqtt-check.ts` (`pnpm fw:mqtt-check`) ya descifra y valida todo esto con `node:crypto` y el paquete `mqtt` (ya instalado). Reusá esa lógica en el módulo `telemetry`.
- **Seguridad:** después de descifrar, exigí que `reading.wearableId` sea igual al `<id>` del tópico y descartá el mensaje si no. No hay AAD y la clave es compartida: sin este chequeo, un sobre válido de una pulsera se puede reinyectar en el tópico de otra.

## Cifrado (RNF-O3)

- **AES-256-GCM** (cifra y autentica). Clave de 32 bytes compartida en `TELEMETRY_AES_KEY` (hex de 64 caracteres). IV aleatorio de 12 bytes por mensaje y tag de 16 bytes.
- En el ESP32-C3 se usa `mbedtls_gcm_*` con el acelerador AES por hardware.
- **Vectores de prueba compartidos:** `GCM_TEST_VECTORS` de `@vitalia/contracts/testing` (NIST TC15, una lectura Vitalia con sobre y un tag alterado). Los tests de descifrado de la API **tienen que** usarlos. El firmware los recibe como `test/fixtures/gcm_vectors.h` (`pnpm fw:codegen`; la CI chequea que esté al día). Si agregás un vector, regenerá el header.
- Node:
  ```ts
  import { createDecipheriv } from 'node:crypto';
  export function decryptEnvelope(env: EncryptedEnvelope, key: Buffer): TelemetryReading {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
    d.setAuthTag(Buffer.from(env.tag, 'base64'));
    const json = Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()]).toString('utf8');
    return JSON.parse(json) as TelemetryReading;
  }
  ```
- Si el tag es inválido, se **descarta** el mensaje y se registra un warning (sin loguear el contenido).

## Backend (✅ Fase 2)

| Módulo | Archivos | Qué hace |
| --- | --- | --- |
| `mqtt/` (global) | `mqtt.service.ts`, `topic-match.ts` | Cliente único: `subscribe(filtro, handler)` (se rehace en cada reconexión), `publishJson()` (devuelve `false` sin broker, nunca lanza), `status()` para el health. Sin `MQTT_URL` queda deshabilitado. |
| `telemetry/` | `envelope.ts` (`openEnvelope`, `decryptGcm`), `reading.schema.ts` (zod estricto), `data-topic.ts`, `seq-deduper.ts`, `telemetry.service.ts` | Pipeline de ingesta (abajo). Sin `TELEMETRY_AES_KEY` no se suscribe. |
| `alerts/` | `alerts.service.ts`, controller, mapper | `raise()`: una alerta por hallazgo CRÍTICO, sin repetir la `ACTIVE` del mismo `kind` y pulsera (set en memoria); emite **antes** de insertar (id con `randomUUID()`). `GET /api/alerts`, `POST /api/alerts/:id/ack`. |
| `wearables/` | `wearables.service.ts`, controller, mapper | Alta (formato + número sin repetir), asignar/liberar, última lectura (`DISTINCT ON`), `findForIngest()`, `touch()` (`last_seen_at`, `last_room`), `showTicket()` → `SHOW_TICKET`. |

Pipeline de `TelemetryService.ingest(topic, payload)` (nunca lanza, devuelve `IngestOutcome`):

1. `parseDataTopic` → `openEnvelope` (base64 estricto, largos de IV/tag, GCM) → `parseReading` (zod: forma estricta; después `dropOutOfRangeFields` saca solo las mediciones fuera de `TELEMETRY_READING_LIMITS`) → `wearableId` = tópico.
2. `findForIngest(code)`: si no existe en `wearables`, se descarta. `SeqDeduper` (últimos 64 seq por pulsera) descarta reenvíos.
3. `vitalsFindings()` (contracts) → hallazgos con `kind`; el nivel y los motivos salen de ahí (misma regla que `assessVitals()`).
4. **Emisión primero:** `telemetry:reading` a `staff` y `AlertsService.raise()` con los hallazgos CRÍTICOS.
5. Persistencia en segundo plano (`idle()` la espera en tests): `INSERT … ON CONFLICT DO NOTHING` (índice único `(wearable_id, seq)`), `touch()` y `TicketsService.escalateTriage()` (solo sube, emite `queue:updated`).
6. Descartes con `warnOnce` (un log por motivo cada 30 s, sin el contenido de la lectura).

Desarrollo local sin Docker: cualquier broker en :1883 sirve; con `pnpm infra:up` es Mosquitto. Con la API corriendo, `pnpm sim:wearables --inject=fall:3@4` tiene que producir `alert:emergency` en la sala `staff` en milisegundos.

## Simulador de wearables (`tools/wearable-simulator/`, `pnpm sim:wearables`)

Proyecto Nx `wearable-simulator` (`scope:tools`): N pulseras que publican `TelemetryReading` cifradas con AES-256-GCM por MQTT (QoS 1), cada una con su conexión y client ID = código, igual que el firmware. Usa `TELEMETRY_AES_KEY` y `MQTT_URL` del `.env`.

```bash
pnpm sim:wearables                                   # wb-02…wb-08 (las del seed) cada 3 s
pnpm sim:wearables --count=50 --duration=600         # carga de la Fase 5
pnpm sim:wearables --inject=fall:3@10 --inject=hypoxia:4@20~60 --seed=7
pnpm sim:wearables --help
```

- Códigos `wb-NN-5e00NN`: `wb-02…wb-08` existen en el seed; las demás sirven para cargar el broker, pero la API las descarta.
- Signos vitales coherentes con `CLINICAL_THRESHOLDS`: ESTABLE en reposo; cada anomalía (`fall`, `hypoxia`, `tachycardia`, `bradycardia`, `fever`, `hypothermia`) es CRÍTICA desde la primera lectura y después vuelve gradualmente (pasa por ATENCIÓN). Una caída se publica en el momento, como el firmware, y el log muestra su `ts` para medir latencia.
- Eventos para probar la API: `reboot` (`seq` salta de bloque), `duplicate` (reenvía la última lectura: deduplicar), `tamper` (tag alterado: descartar) y `spoof` (última lectura en el tópico de otra pulsera: descartar).
- `seq`: el arranque inicial son los segundos desde 2024, así cada corrida usa un bloque nuevo y la deduplicación no descarta lecturas.
- En la terminal se pueden inyectar eventos escribiendo `fall 3`, `hypoxia 4 60` o `estado`.
- Validación cruzada: `pnpm fw:mqtt-check` en otra terminal tiene que marcar ✔ todo salvo `tamper` y `spoof`.

## Reglas

- Los umbrales salen de `CLINICAL_THRESHOLDS` y la clasificación de `assessVitals()`. **No dupliques reglas.**
- La red IoMT (VLAN 10) solo llega a Mosquitto :1883. El wearable nunca habla HTTP con la API.
- Fase 4: usuario = código del wearable y contraseña con `mosquitto_passwd` (se carga a mano en el `secrets.h` de cada pulsera) + ACL con `%u` en Mosquitto (`infra/mosquitto/`).
- Tests: `envelope.spec.ts` (los tres `GCM_TEST_VECTORS` + sobres malformados), `reading.schema.spec.ts` (rangos, topic, dedupe), `telemetry.service.spec.ts` (pipeline con mocks: spoof, tag alterado, duplicado, emite antes de persistir), `alerts.service.spec.ts` y el E2E de `app.int.spec.ts` (broker `aedes` en proceso). Helper de sobres para specs: `apps/api/src/testing/telemetry.ts`.
