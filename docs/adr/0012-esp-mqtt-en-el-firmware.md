# 0012. Usar ESP-MQTT (y no PubSubClient) en el firmware del wearable

- Estado: Aceptado
- Fecha: 2026-10-12
- Autores: Facundo Gomez Geneiro

## Contexto

El contrato pide **QoS 1** para la telemetría (`MQTT_QOS`, docs/04-contratos.md) y el firmware tiene que seguir operando si el broker se cae un rato (AGENTS.md del firmware, §8). La guía del POC asumía **PubSubClient**, pero esa librería solo **publica con QoS 0**: una lectura perdida en el aire no se reintenta. Además, no tiene ningún buffer para cuando no hay conexión.

## Decisión

Usar **ESP-MQTT** (`mqtt_client.h`), el cliente de Espressif que ya viene con el Arduino Core ESP32 (no suma dependencias):

- QoS 1 real: guarda el mensaje hasta el PUBACK y lo reintenta.
- `esp_mqtt_client_enqueue(..., store = true)` deja el mensaje en el **outbox** aunque en ese momento no haya conexión, y lo envía al reconectar.
- Corre en su propia tarea de FreeRTOS: `loop()` no se bloquea esperando la red.
- Reconexión automática (5 s) y keepalive de 30 s.

Se encapsula en `lib/net/mqtt_link` (`net::MqttLink`). Se quita `knolleary/PubSubClient` de `platformio.ini`.

## Alternativas consideradas

- **PubSubClient:** solo QoS 0 al publicar; el buffering offline habría que escribirlo a mano.
- **arduino-mqtt (256dpi):** publica con QoS 1, pero no tiene outbox persistente y suma una dependencia.

## Consecuencias

- (+) El contrato (QoS 1) se cumple de verdad y los cortes cortos del broker no pierden lecturas.
- (+) No hay dependencia nueva; el cifrado (mbedTLS) también viene con el core.
- (−) **El outbox descarta los mensajes que llevan 30 s sin PUBACK** (`OUTBOX_EXPIRED_TIMEOUT_MS`, fijo en el SDK precompilado del core). Cubre cortes cortos; para cortes largos hace falta un buffer propio (en RAM o en flash), anotado en el roadmap (Fase 5). El firmware además limita el outbox a `MQTT_OUTBOX_MAX_BYTES` para no llenar la RAM.
- (−) La flash usada sube de ~66 % a ~77 % (ESP-MQTT + transporte). Queda margen, pero conviene vigilarlo cuando entre el MAX30102.
- La API usa el paquete `mqtt` de Node (ya en el `package.json`), que también usa `pnpm fw:mqtt-check`.
