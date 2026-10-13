# Estado del proyecto — Firmware wearable IoMT (POC PTI)

> Handoff para continuar en otra máquina. Fecha: 2026-09-01. Migrado al monorepo Vitalia el 2026-10-06 ([ADR 0010](../../docs/adr/0010-firmware-del-wearable-en-el-monorepo.md)).
> La guía de desarrollo completa está en [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` apunta ahí).

---

## Dónde estamos

Validación de hardware por hitos (ver `AGENTS.md` sección 9). Se avanza en orden, sin
pasar al siguiente hasta que el anterior pasa.

| Hito                   | Estado                                        | Notas                                                                                                                                                                                                        |
| :--------------------- | :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Escáner I²C         | ✅ **PASA**                                   | Las 4 direcciones detectadas: `0x3C` OLED, `0x57` MAX30102, `0x5A` MLX90614, `0x68` MPU6050                                                                                                                  |
| 2. OLED SSD1306        | ✅ **PASA**                                   | Texto estático OK. Ver gotcha del reloj abajo.                                                                                                                                                               |
| 3. MPU6050             | ✅ **PASA**                                   | ~1.05 g en reposo (dentro de tolerancia, offset de fábrica). REST/MOV OK.                                                                                                                                    |
| 4. MLX90614            | ⚠️ **PARCIAL — recalibración fina pendiente** | El sensor funciona tras recuperar la EEPROM. Falta la curva de compensación fina, que requiere la carcasa/correa (ver abajo).                                                                                |
| 5. MAX30102 (BPM/SpO2) | ⛔ **NO EMPEZADO**                            | Próximo paso.                                                                                                                                                                                                |
| 6a. Wi-Fi (asociación) | ✅ **PASA**                                   | Asocia, obtiene IP, RSSI excelente. Quirk: el 1er `WiFi.begin()` post-boot falla, el 2do conecta (retry automático). Client ID MQTT = `wb-01-24d7cc` (número físico 01 + MAC `44:BD:8D:24:D7:CC`, ADR 0011). |
| 6b. MQTT               | ⛔ pendiente                                  | Depende de tener Mosquitto corriendo en el Edge Gateway. `MQTT_BROKER` en `secrets.h` hay que ponerlo con la IP real del gateway.                                                                            |
| 7. Cifrado AES-256     | ⛔ pendiente                                  |                                                                                                                                                                                                              |
| 8. Detección de caídas | ⛔ pendiente                                  |                                                                                                                                                                                                              |

---

## Hito 4 — MLX90614: qué pasó y qué falta

### Lo resuelto

El sensor medía **+28 °C sobre piel** (61 °C en muñeca real ~33 °C), estable, con
emisividad 1.00 y `Ta` correcta. Causa: **EEPROM `Config1` (registro `0x25`) corrupta**
— ganancia en ×12.5 en vez de ×100 y bits de signo Ks/KT2 invertidos (leído `0xAFF4`,
correcto `0x9FB4`). Probable origen: ESD por punta de soldador sin descarga a tierra
al soldar los pines (era la primera soldadura).

**Recuperado** reescribiendo `0x25 = 0x9FB4` (ciclo borrar→escribir SMBus) y **ciclando
la alimentación del sensor** (el MLX solo carga la config de EEPROM al arrancar; el
reset del ESP32 no alcanza si el sensor sigue con 3V3). El sketch de diagnóstico
profundo con esa capacidad quedó en el historial de git (commit inicial); la lógica
está en las funciones `rawWrite16` / `eepromWriteCell` / `writeConfig1Flow`.

### Verificación post-fix

| Objetivo                | Real                   | MLX       | Error       | Comentario                                                       |
| :---------------------- | :--------------------- | :-------- | :---------- | :--------------------------------------------------------------- |
| Aire                    | = Ta                   | = Ta      | ~0          | OK                                                               |
| Agua tibia              | 35.7                   | ~40.5     | +4.8        | **Artefacto: condensación del vapor sobre el lente. Descartar.** |
| Muñeca (seco, asentado) | 36.3–36.8 (sublingual) | 35.3–36.2 | −0.5 a −1.4 | Lectura buena; delta piel→central razonable                      |

Repetibilidad de 3 mediciones seguidas de la misma muñeca: MLX entre **35.3 y 37.5**
(~1–2 °C de dispersión). La prueba más limpia y asentada dio piel ≈ central − 1.2 °C
a ambiente ~23 °C.

### Qué falta (recalibración fina)

1. La dispersión de ~1–2 °C está dominada por la **geometría no repetible** (sensor
   sostenido a mano; gap/ángulo/sellado de la cavidad de aire cambian entre medidas).
   **La curva `central ≈ f(piel, Ta)` solo tiene sentido con la correa/carcasa que
   fije la geometría.** Calibrar antes = caracterizar el ruido del pulso.
2. Cuando exista el fixture físico: recolectar 5–8 puntos `(piel_avg30, Ta, comercial)`
   a distintos ambientes (sala normal, frente a ventilador/AC, ambiente < 20 °C, otra
   persona) y ajustar `central ≈ a·piel + b·Ta + c`. Llevar el resultado a `config.h`.
3. Provisional hasta entonces: `SKIN_TO_CORE_OFFSET_C = 1.2f`.
4. Firmware: temperatura como **indicador grueso**. Alerta de fiebre en **> 38.0 °C**
   estimados (no 37.5) para no acumular falsos positivos.
5. El sensor cerrado contra la muñeca se **autocalienta** (`Ta` +3.6 °C en 3 min
   continuos). La carcasa debe disipar o el firmware compensar `Ta` según uptime.
6. Conseguir un **GY-906 de repuesto** (el actual tiene historial de daño; alimentarlo
   siempre a 3.3 V, soldar con soldador con tierra o muñequera antiestática).

---

## Próximo trabajo (en orden)

1. **Recalibración fina de temperatura** — bloqueada hasta tener la carcasa/correa.
   Mientras tanto usar el offset provisional.
2. **Hito 5 — MAX30102 (BPM / SpO2).** El más delicado de calibrar. Empezar con
   lectura de BPM estable con el dedo apoyado y SpO2 contra un oxímetro comercial.
   Librería: `sparkfun/SparkFun MAX3010x`. Dirección `0x57`. Ojo con la alimentación:
   el módulo violeta necesita **5 V en VIN** (ver `AGENTS.md` 2.2).
3. ✅ **Firmware reestructurado y alineado al contrato** (2026-10-07): `lib/` (telemetry,
   fall_detection, sensors, net, ui), `config.h`, `vitalia_contracts.h` generado, NTP, `seq`
   por arranque y tests native (`pnpm fw:test`). La demo ya sirve `TelemetryReading` en `/data`.
   **Pendiente de probar en la placa** (ver "Cómo compilar / subir").
4. **Hito 6b — MQTT.** `main.cpp` ya arma la `TelemetryReading` cada 3 s (`lastReadingJson`):
   falta publicarla. Módulo MQTT en `lib/net` con PubSubClient contra Mosquitto, `client.setBufferSize(512)`
   (gotcha AGENTS.md 3), publicar `TelemetryReading` en claro al tópico `hospital/<sala>/wearable/<id>/data`
   y verificar con `mosquitto_sub`. Para probar sin el gateway: `pnpm infra:up` levanta Mosquitto en la notebook.
5. Hitos 7–8 después (Hito 7 = GCM, ADR 0006).

Estructura actual del firmware: `AGENTS.md` §5.

---

## Gotchas descubiertos esta sesión (ya en AGENTS.md sección 3)

- **Adafruit_SSD1306 sube el bus a 400 kHz** durante cada `display.display()` y lo baja
  después. En bus compartido con el MLX90614 (SMBus, máx 100 kHz) + 4 dispositivos
  hand-wired eso corrompe la transferencia (píxeles al azar). Fijar el constructor:
  `Adafruit_SSD1306 display(W, H, &Wire, RST, 100000, 100000);`
- **MLX90614 Config1 corrupta** — síntoma, causa y fix descritos arriba y en AGENTS.md.
- **MLX90614 siempre a 3.3 V, nunca 5 V.**
- **`pio` no está en el PATH** de la terminal en la máquina original; se usaba
  `& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe"`. En la notebook puede variar.

---

## Cómo compilar / subir

Desde la raíz del monorepo: `pnpm fw:build`, `pnpm fw:upload` y `pnpm fw:monitor` (ver `AGENTS.md` §4).
Dentro de `apps/wearable-firmware-poc`, con PlatformIO directo:

```bash
pio run                       # compilar
pio run -t upload             # subir por USB-C
pio run -t upload -t monitor  # subir + monitor serie (115200)
pio device monitor            # solo monitor
```

Si el puerto está ocupado: cerrar el monitor serie antes de subir. Si la placa no
aparece: mantener BOOT presionado mientras se conecta el USB.

**El firmware actual** arma una `TelemetryReading` del contrato cada 3 s y la expone por HTTP
(acelerómetro, temperatura, OLED, Wi-Fi, NTP). No incluye MAX30102 (Hito 5) ni MQTT (Hito 6b).

Al arrancar, el monitor serie muestra `wearableId: wb-01-24d7cc  arranque: N`, después
`WiFi OK` y `NTP OK`. Recién con NTP aparecen lecturas.

- OLED: IP (o `WiFi...`), temperatura estimada (o `NTP...` hasta sincronizar) y aceleración + evento.
- Servidor HTTP en el puerto 80:
  - `http://<IP>/` → página web con telemetría en vivo (fetch cada 1 s, sin recursos
    externos, funciona sin internet).
  - `http://<IP>/data` → la última `TelemetryReading`, tal cual se va a publicar por MQTT
    (503 hasta tener hora NTP). Sin `hr`/`spo2` hasta el Hito 5. `seq` crece cada 3 s y salta
    de bloque en cada reinicio.
  - `http://<IP>/status` → diagnóstico: sensores, NTP, arranque, RSSI, temperatura de piel.
  - `http://wearable-pti.local/` → lo mismo vía mDNS.
- Detección de caída (preview, Hito 8 pendiente): `|a| > 2.8 g` → `fall: true` en la próxima lectura; el OLED y la página muestran CAÍDA durante 5 s.
- Fiebre (solo indicador del OLED): temperatura central estimada > 38.0 °C (offset provisional +1.2, ver arriba). La alerta la decide la API.
- En la universidad: cambiar SSID/PASS en `src/secrets.h`.
- **Requisito de red:** notebook y dispositivo en el mismo SSID **sin client isolation**.
  Hotspots de celular y redes guest suelen bloquear el tráfico device-to-device →
  usar router de laboratorio propio o hotspot con aislamiento de clientes desactivado.

Los sketches anteriores de cada hito (escáner I²C, OLED, MPU6050, calibración MLX90614,
asociación Wi-Fi) están en el historial de git — `git log --oneline -- apps/wearable-firmware-poc` y
`git show <commit>:apps/wearable-firmware-poc/src/main.cpp` (después del `nx import` las rutas
del historial incluyen el prefijo `apps/wearable-firmware-poc/`).
