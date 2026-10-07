# 0011. Identificar cada wearable como `wb-<NN>-<mac>`

- Estado: Aceptado
- Fecha: 2026-10-07
- Autores: Facundo Gomez Geneiro

## Contexto

El identificador del wearable es, a la vez, el `<id>` del tópico MQTT, el `wearableId` de `TelemetryReading`, `wearables.code` en la base y (Fase 4) el usuario de Mosquitto. Había dos formatos incompatibles:

- El seed de la API usaba `w-01…w-08`: fácil de leer, pero no se puede relacionar con el dispositivo en la red.
- El firmware publicaba `wb-24d7cc`, derivado de la MAC: estable y útil para diagnosticar, pero imposible de ubicar a simple vista entre varias pulseras.

## Decisión

Formato **`wb-<NN>-<mac>`**, por ejemplo `wb-07-24d7cc`:

- `NN`: número físico de la pulsera (el de la etiqueta), 01–99 con dos dígitos. En el firmware es `WEARABLE_NUMBER` en `secrets.h`, que se configura por dispositivo.
- `mac`: últimos 3 bytes de la MAC Wi-Fi en hex minúscula. Lo calcula el firmware solo, y sirve para cruzarlo con DHCP o ARP del RUT956.
- Regla en `@vitalia/contracts`: `WEARABLE_CODE_PATTERN`, `formatWearableCode()` y `parseWearableCode()`.
- Seed: `wb-01-24d7cc` es la pulsera física del equipo; `wb-02…wb-08` son simuladas, con sufijos de MAC inventados (`5e00NN`).
- Fase 4: el código también es el **usuario de Mosquitto**. La contraseña se genera con `mosquitto_passwd` y se carga a mano en `secrets.h`. El ACL usa `%u` para que cada pulsera solo publique en `.../wearable/<su código>/data` y lea `.../cmd`.

## Alternativas consideradas

- **Solo número (`w-07`):** no permite diagnosticar la red; dos placas configuradas con el mismo número quedarían indistinguibles.
- **Solo MAC (`wb-24d7cc`):** el personal no puede identificar la pulsera física por el código.
- **MAC completa:** códigos largos en el OLED, los logs y la UI, sin ganancia real a esta escala (los 3 bytes del OUI son del fabricante).

## Consecuencias

- (+) Un mismo código sirve para la operación (número) y para el diagnóstico de red (MAC).
- (+) Si dos placas comparten número por error, se distinguen por el sufijo y la base rechaza el duplicado de `code`.
- (−) Al cambiar la placa de una pulsera, cambia el código: hay que actualizar `wearables.code` y el usuario de Mosquitto.
- (−) El seed borra los códigos viejos `w-NN` de las bases de desarrollo (limpieza temporal, se quita después de la Fase 2).
