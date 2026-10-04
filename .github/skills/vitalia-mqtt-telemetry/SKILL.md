---
name: vitalia-mqtt-telemetry
description: Ingesta de telemetría IoMT por MQTT en la API - conexión a Mosquitto, suscripción a hospital/+/wearable/+/data, descifrado AES-256-GCM, validación del payload, clasificación con assessVitals, persistencia, generación de alertas y comandos al wearable; también el simulador de wearables para pruebas de carga. Usala para todo lo relacionado con wearables, MQTT, cifrado o alertas biométricas.
---

# Telemetría MQTT (wearable → Edge Gateway)

## Contrato (en `@vitalia/contracts`)

- Tópico de datos: `MQTT_TOPICS.wearableData(room, id)` → `hospital/<sala>/wearable/<id>/data`. Suscripción: `MQTT_TOPICS.allWearableData`.
- Comandos al wearable (OLED): `MQTT_TOPICS.wearableCommand(room, id)` → `.../cmd`.
- QoS: `MQTT_QOS = 1`.
- Payload publicado: `EncryptedEnvelope { v: 1, iv, ct, tag }` (base64). Descifrado: `TelemetryReading { wearableId, seq, ts, hr?, spo2?, temp?, accPeakG?, fall? }`.

## Cifrado (RNF-O3)

- **AES-256-GCM** (cifra y autentica). Clave de 32 bytes compartida en `TELEMETRY_AES_KEY` (hex de 64 caracteres). IV aleatorio de 12 bytes por mensaje y tag de 16 bytes.
- En el ESP32-C3 se usa `mbedtls_gcm_*` con el acelerador AES por hardware.
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

## Backend (Fase 2): `apps/api/src/modules/telemetry/`

```bash
pnpm add mqtt
```

1. `MqttClientService` (OnModuleInit/OnModuleDestroy): conecta a `MQTT_URL` con reconexión y se suscribe con QoS 1.
2. Por cada mensaje: parsear el sobre → descifrar → validar rangos (zod) → descartar duplicados por `(wearableId, seq)`.
3. `assessVitals(reading)` (contracts) → nivel y motivos.
4. Persistir la lectura (Fase 1: tabla `telemetry_readings`, indexada por `wearable_id, ts`).
5. Emitir `telemetry:reading` a `staff`. Si `level === 'CRITICAL'`, crear `Alert` y emitir `alert:emergency` (skill `vitalia-realtime`).
6. **Camino crítico sin bloqueos:** la emisión WS va antes de la persistencia o en paralelo. La persistencia nunca demora la alerta.

## Simulador de wearables (Fase 2, `tools/wearable-simulator/`)

Script Node que emula **50 pulseras publicando cada 3 s** (§11.1.4) con valores normales y anomalías inyectables (caída, hipoxia), cifrando con la misma clave. Sirve para desarrollar sin hardware y para las pruebas de carga y latencia de la Fase 5.

## Reglas

- Los umbrales salen de `CLINICAL_THRESHOLDS` y la clasificación de `assessVitals()`. **No dupliques reglas.**
- La red IoMT (VLAN 10) solo llega a Mosquitto :1883. El wearable nunca habla HTTP con la API.
- Fase 4: usuario y contraseña por wearable + ACL en Mosquitto (`infra/mosquitto/`).
- Tests: `decryptEnvelope` con vectores conocidos (cifrar y descifrar), descarte por tag inválido y deduplicación por `seq`.
