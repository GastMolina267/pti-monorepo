# 0006. AES-256-GCM para la telemetría del wearable

- Estado: **Propuesto** (validar con el firmware en la Fase 2)
- Fecha: 2026-10-03

## Contexto

RNF-O3 exige AES-256 para los datos médicos por aire. El ESP32-C3 tiene aceleración AES por hardware (mbedTLS). MQTT corre en el 1883 sin TLS dentro de una VLAN aislada.

## Propuesta

Cifrar el **contenido** del mensaje MQTT con **AES-256-GCM**: IV aleatorio de 12 bytes por mensaje y tag de 16 bytes, empaquetados en un sobre JSON `{ v, iv, ct, tag }` en base64. La clave de 32 bytes se comparte por entorno (`TELEMETRY_AES_KEY`).

## Alternativas

- **AES-256-CBC:** cifra pero no autentica (posible manipulación); requiere HMAC aparte.
- **TLS en Mosquitto (8883):** protege el transporte, pero es más costoso en el ESP32 y no es lo que pide la tesis.

## Consecuencias

- (+) Confidencialidad **e integridad**. El gateway descarta mensajes alterados.
- (−) La clave es compartida entre todos los wearables: en producción habría que usar una clave por dispositivo (evolución futura).
- Diferencia con la tesis: la tesis habla de "cifrado en capa de transporte". En rigor, esto es cifrado a nivel de aplicación (contenido del mensaje).
