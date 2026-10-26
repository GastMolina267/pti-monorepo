# 0023. Descartar solo la medición fuera de rango, no la lectura entera

- Estado: Aceptado
- Fecha: 2026-10-26
- Autores: Facundo Gomez Geneiro (decisión acordada con Gastón Molina)

## Contexto

`TELEMETRY_READING_LIMITS` (contracts, PR #13) fija rangos físicos para `hr` (20–250), `spo2` (50–100), `temp` (25–45) y `accPeakG` (0–16). No son umbrales clínicos: un valor afuera es un sensor sin poner o roto. Hasta este cambio, la API descartaba **la lectura entera** si una sola medición se salía.

En la prueba en la placa del 21/10 se vieron dos casos reales:

- Con la pulsera sin poner, el MLX90614 mide el aire (~23 °C). La API tiraba la lectura completa, con `hr`, `spo2` y `accPeakG` válidos.
- En un golpe fuerte, la magnitud de los tres ejes pasa los 16 g, y esa es justo la lectura que lleva `fall: true`. Descartarla perdía **la alerta de caída**.

El firmware ya omite o satura esos valores (`applyReadingLimits()`, PR #13). Pero la API no puede depender de eso: un firmware viejo, otro dispositivo o un sensor que falla de otra forma vuelven a perder la lectura.

## Decisión

- **Una medición fuera de rango se descarta sola.** `dropOutOfRangeFields()` (en `@vitalia/contracts`, compartida) saca ese campo y devuelve cuáles sacó. La API procesa el resto de la lectura (`fall` incluido, alertas, persistencia) y deja un aviso en el log, como mucho uno por pulsera y campo cada 30 s. Los bordes son inclusivos.
- **Un mensaje mal armado se sigue descartando entero:** un tipo equivocado (`hr: "78"`), un campo fuera del contrato o un `wearableId`/`seq`/`ts`/`fall` inválido. Eso no es un sensor que mide mal: es un firmware roto o un mensaje alterado.
- **`pnpm fw:mqtt-check` aplica la misma regla:** fuera de rango es un aviso (⚠), y la forma inválida, un error (✖). Incluye `ts`, que tiene que ser un entero, igual que en la API.
- El firmware sigue omitiendo o saturando antes de publicar, así que normalmente la API no tiene nada que descartar.

## Alternativas consideradas

- **Descartar la lectura entera (lo que había):** simple, pero pierde datos válidos y, en el caso del golpe, la caída. Se descartó.
- **Saturar en la API** (llevar el valor al límite del rango en lugar de sacarlo): inventa un dato que el sensor no midió. En `temp` o `spo2` puede disparar o tapar una alerta. Solo el firmware satura `accPeakG`, porque ahí el límite conserva el dato real de que "hubo un golpe fuerte".
- **Aceptar cualquier valor y dejar que `assessVitals()` decida:** una temperatura de 23 °C con la pulsera sin poner se clasificaría como hipotermia. Se descartó.

## Consecuencias

- Una caída o una medición válida llegan aunque otro sensor de la misma lectura falle.
- La persistencia guarda `null` en la columna descartada, igual que cuando el firmware omite el campo.
- Los avisos del log permiten ver una pulsera con un sensor roto sin perder sus otras mediciones.
- Cambiar los rangos es un cambio de contrato: se hace en `TELEMETRY_READING_LIMITS` y llega a la API, a `fw:mqtt-check` y al firmware (`fw:codegen`).
