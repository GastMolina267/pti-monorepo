# Estado del proyecto — Firmware wearable IoMT (POC PTI)

> Handoff para continuar en otra máquina. Fecha: 2026-09-01. Migrado al monorepo Vitalia el 2026-10-06 ([ADR 0010](../../docs/adr/0010-firmware-del-wearable-en-el-monorepo.md)).
> La guía de desarrollo completa está en [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` apunta ahí).

---

## Dónde estamos

**Software 4c (18/10/2026):** recepción de `SHOW_TICKET`, validación y reensamblado acotado, resuscripción MQTT por conexión y cola hacia el `loop()` implementados. El OLED muestra el último llamado, desplaza consultorios largos y conserva la prioridad de caída local. Pruebas sin placa: `pnpm nx run wearable-firmware-poc:pio-check-docker`; alcance y límites en [ADR 0015](../../docs/adr/0015-recibir-comandos-en-el-firmware.md). Esto no cambia los resultados físicos de los hitos listados abajo: no se flasheó ni calibró hardware con esta entrega.

**Demo completa y estado de la pulsera (26/10/2026):** la pulsera publicó directo al gateway (sin puente) y ahora sabe si está libre, asignada o llamada: el llamado se borra al pasar a atención y, sin llamado, el OLED muestra el turno y los signos del paciente ([ADR 0021](../../docs/adr/0021-estado-de-la-pulsera-por-comandos.md)). Detalle en "Demo completa contra el gateway" abajo.

**Prueba en la placa (21/10/2026):** primera vez que corre en la placa el firmware reestructurado (#4/#5) con MQTT + AES-256-GCM (#7). Pasan los hitos 6b y 7 contra el Mosquitto de desarrollo (`pnpm infra:up`) en la notebook, y el llamado en el OLED (`SHOW_TICKET`). Detalle en "Prueba en la placa del 21/10" abajo. La calibración de caídas queda para cuando el circuito esté soldado en la pulsera (en la protoboard los golpes aflojan los cables).

Validación de hardware por hitos (ver `AGENTS.md` sección 9). Se avanza en orden, sin
pasar al siguiente hasta que el anterior pasa.

| Hito                   | Estado                                        | Notas                                                                                                                                                                                                                                                                                                           |
| :--------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Escáner I²C         | ✅ **PASA**                                   | Las 4 direcciones detectadas: `0x3C` OLED, `0x57` MAX30102, `0x5A` MLX90614, `0x68` MPU6050                                                                                                                                                                                                                     |
| 2. OLED SSD1306        | ✅ **PASA**                                   | Texto estático OK. Ver gotcha del reloj abajo.                                                                                                                                                                                                                                                                  |
| 3. MPU6050             | ✅ **PASA**                                   | ~1.05 g en reposo (dentro de tolerancia, offset de fábrica). REST/MOV OK.                                                                                                                                                                                                                                       |
| 4. MLX90614            | ⚠️ **PARCIAL — recalibración fina pendiente** | El sensor funciona tras recuperar la EEPROM. Falta la curva de compensación fina, que requiere la carcasa/correa (ver abajo).                                                                                                                                                                                   |
| 5. MAX30102 (BPM/SpO2) | ✅ **PASA — primera validación** (26/10)      | Con el dedo apoyado en la protoboard, contra una smartband (82–87 lpm, 99 %): 73–89 lpm (casi siempre 79–88) y SpO₂ 97–100 %. Con movimiento o sin dedo, la lectura omite `hr`/`spo2`. Falta afinarlo en la muñeca, con la pulsera (ver abajo).                                                                 |
| 6a. Wi-Fi (asociación) | ✅ **PASA**                                   | Asocia, obtiene IP, RSSI excelente. Potencia de transmisión en 8,5 dBm (`WIFI_TX_POWER_QDBM`, provisional): hubo un período con `AUTH_EXPIRE` sin conectar (ver abajo). Con 8,5 dBm conecta en 1 a 3 intentos (3–10 s). Client ID MQTT = `wb-01-24d7cc` (número físico 01 + MAC `44:BD:8D:24:D7:CC`, ADR 0011). |
| 6b. MQTT               | ✅ **PASA** (21/10, dev y gateway)            | QoS 1 contra el Mosquitto de desarrollo y contra el gateway con usuario y contraseña de la pulsera (ADR 0014): lecturas descifradas y guardadas por la API, llamado recibido en el OLED, ACL que rechaza a la pulsera escribiendo comandos.                                                                     |
| 7. Cifrado AES-256     | ✅ **PASA** (21/10)                           | `pio-test-device`: 3/3 en la placa (vectores compartidos, tag alterado rechazado, ida y vuelta con IV aleatorio). `fw:mqtt-check` descifra todas las lecturas con la clave del `.env`.                                                                                                                          |
| 8. Detección de caídas | ⏸️ **EN ESPERA — calibrar con la pulsera**    | Lógica validada con el sensor real en la protoboard (21/10): una caída confirmada y publicada, un falso positivo rechazado. La calibración se hace con el circuito soldado dentro de la pulsera impresa: en la protoboard los golpes aflojan los cables del bus I²C (ver abajo).                                |

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
2. ✅ **Hito 5 — MAX30102 (BPM / SpO2)**, primera validación el 26/10 (ver "Prueba del MAX30102").
   `sensors::PulseOx` lee la FIFO y `lib/ppg` calcula BPM y SpO2 con un filtro de calidad.
   Falta afinarlo con el sensor en la muñeca, dentro de la pulsera: la señal y el movimiento
   ahí son distintos a los de un dedo apoyado. Ojo con la alimentación: el módulo violeta
   necesita **5 V en VIN** (ver `AGENTS.md` 2.2).
3. ✅ **Firmware reestructurado y alineado al contrato** (2026-10-07): `lib/` (telemetry,
   fall_detection, sensors, net, ui), `config.h`, `vitalia_contracts.h` generado, NTP, `seq`
   por arranque y tests native (`pnpm fw:test`). La demo ya sirve `TelemetryReading` en `/data`.
   ✅ Probado en la placa el 21/10 (ver "Prueba en la placa del 21/10").
4. ✅ **Hitos 6b y 7** (2026-10-12, probados en la placa el 21/10): cada 3 s la `TelemetryReading` se
   cifra con AES-256-GCM y se publica con QoS 1 por ESP-MQTT (ADR 0012). Para repetir la prueba:
   1. Misma clave en `TELEMETRY_AES_KEY` (`.env`) y `TELEMETRY_AES_KEY_HEX` (`secrets.h`); `MQTT_BROKER` = IP de la notebook.
   2. `pnpm infra:up` (Mosquitto local) y `pnpm nx run wearable-firmware-poc:pio-test-device` (vectores GCM en la placa).
   3. `pnpm fw:upload` y `pnpm fw:mqtt-check`: cada lectura tiene que salir ✔.
   4. ✅ Contra el gateway (`pnpm gateway:up`) con `MQTT_USER`/`MQTT_PASS` de la pulsera: probado el 21/10 (ver "Prueba contra el gateway").
5. ✅ **Llamado en el OLED (4c)**, probado en la placa el 21/10: `TE LLAMAN` con código y consultorio, reemplazo por el llamado nuevo, scroll de consultorios largos y tildes/ñ transliteradas. Falta ver la prioridad de una caída local sobre el llamado (con el Hito 8, en la pulsera).
6. ⏸️ **Hito 8 — caídas:** la lógica ya está (`lib/fall_detection/src/fall_detector.h`, 2026-10-13) y se validó en la protoboard el 21/10 (ver "Prueba de caídas en la protoboard"). **La calibración espera la pulsera:** primero hay que pasar el circuito a una protoboard chica o a una placa perforada con pistas soldadas, sin cables que se aflojen, y montarlo en la pulsera impresa. Recién ahí tienen sentido los valores de `config.h`, porque dependen de cómo cae y se mueve una muñeca y no una protoboard. Pasos para ese momento:
   1. Con `FALL_LOG_TRANSITIONS = true`, el monitor serie imprime cada cambio de fase (`IDLE -> FREE_FALL -> AWAIT_IMPACT -> SETTLING -> CHECK_STILL`) con la aceleración. `/status` muestra `fall_state`, `impact_recent` y `fall_recent`.
   2. Caídas controladas sobre superficie acolchada con la pulsera puesta: si la muñeca no llega a marcar caída libre (< 0,4 g por 60 ms), bajar `FALL_FREE_FALL_MIN_MS`, subir `FALL_FREE_FALL_G` o, en último caso, `FALL_REQUIRE_FREE_FALL = false`.
   3. Falsos positivos: golpes de la mano contra la mesa, sentarse de golpe, aplaudir. No tienen que confirmar caída (sin caída libre o con movimiento después).
   4. Ajustar `FALL_STILL_TOLERANCE_G` con el offset real del MPU6050 en reposo (~1,05 g).

Estructura actual del firmware: `AGENTS.md` §5.

---

## Prueba en la placa del 21/10

Placa `wb-01-24d7cc` por USB (COM3), Wi-Fi `Dp7` (IP `192.168.100.28`, RSSI −32 a −36 dBm) y la notebook por Ethernet en la misma red (`192.168.100.17` = `MQTT_BROKER`), con el Mosquitto de `pnpm infra:up`.

| Prueba                                           | Resultado                                                                                                         |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `pio-test-device` (lib/crypto en la placa)       | ✅ 3/3: vectores compartidos, tag alterado rechazado, ida y vuelta con IV aleatorio                               |
| Arranque                                         | ✅ `OLED:OK MPU6050:OK MLX90614:OK`, `wearableId: wb-01-24d7cc`, `WiFi OK`, `NTP OK`, `MQTT OK`                   |
| `/data` y `/status`                              | ✅ `TelemetryReading` cada 3 s con `ts` en ms actual; contadores MQTT con publicadas = confirmadas, 0 descartadas |
| `seq` entre reinicios                            | ✅ el arranque pasa de 1 a 2 y `seq` de `16777223` a `33554439` (bloque siguiente)                                |
| `fw:mqtt-check`                                  | ✅ todas las lecturas descifran con la clave del `.env`, `wearableId` = tópico y `seq` sin huecos                 |
| Lecturas fuera de rango (ver abajo)              | ✅ corregido: 6/6 ✔ con la pulsera sin poner                                                                      |
| Llamado en el OLED (`SHOW_TICKET` por `.../cmd`) | ✅ ver abajo                                                                                                      |
| Caídas en la protoboard (sin calibrar)           | ✅ lógica: 1 confirmada y 1 rechazada · ⚠️ golpes aflojan el bus I²C, ver abajo                                   |

**Llamado en el OLED.** Se publicó con `mosquitto_pub` (QoS 1, sin retain) en `hospital/sala1/wearable/wb-01-24d7cc/cmd`, mirando el OLED:

1. `A-024` / `Consultorio 4`: aparece `TE LLAMAN` con el código y el consultorio.
2. `B-107` / `Consultorio 12 - Clinica Medica y Traumatologia Pediatrica`: reemplaza al anterior y el consultorio se desplaza completo.
3. `C-005` / `Cardiología Niñez - Atención Pediátrica` (UTF-8): se ve `Cardiologia Ninez - Atencion Pediatrica`, sin caracteres raros.

Mientras tanto la telemetría siguió normal (213 publicadas, 213 confirmadas).

**Prueba de caídas en la protoboard.** Con `FALL_LOG_TRANSITIONS = true`, dejando caer la protoboard sobre una superficie acolchada (la pulsera no está impresa). Sirve para validar la lógica con el sensor real, no para calibrar:

- ✅ **Caída confirmada:** `IDLE -> FREE_FALL (0,19 g) -> SETTLING (impacto 8,93 g) -> CHECK_STILL -> confirmada`. Llegó al broker con `fall: true` y pico 8,93 g.
- ✅ **Falso positivo rechazado:** caída libre e impacto de 7,53 g, pero con movimiento después (2,92 g): vuelve a `IDLE` sin confirmar.
- Cuatro caídas no pasaron de `FREE_FALL`: la caída libre duró menos de `FALL_FREE_FALL_MIN_MS` (60 ms). Es un dato para calibrar con la pulsera, no una conclusión.
- ⚠️ **Los golpes aflojaron el bus I²C:** ~3200 errores `Wire ... Error -1` en 5 min, con el MPU6050 y el MLX90614 a la vez (cable de SDA, SCL o GND flojo). Al final el MPU6050 devolvía valores congelados.
- ⚠️ En paralelo se cortó la conexión MQTT dos veces (`Writing didn't complete in specified timeout`, el OLED mostró `LLAMADO SIN RED`) y la lectura de la caída llegó **~5 s tarde** (objetivo < 2 s) y repetida por QoS 1. Hay que volver a medir la latencia con el circuito soldado: con el bus I²C fallando no se puede separar la causa.

**Hallazgo: lecturas descartadas enteras.** La API (y `fw:mqtt-check`) descartan la lectura completa si un campo se sale del rango físico. En la placa pasaba en dos casos:

- **Pulsera sin poner:** el MLX90614 mide el aire (~23 °C) y `temp` queda debajo de 25 °C. Se descartaban todas las lecturas, con su `accPeakG` y su `fall`.
- **Golpe fuerte:** `accPeakG` es la magnitud de los 3 ejes, que puede pasar los 16 g aunque cada eje sature en 16 g. Justo la lectura con `fall: true` podía descartarse.

Fix: los rangos están en `TELEMETRY_READING_LIMITS` (contracts), los usan la API, `fw:mqtt-check` y el firmware (vía `vitalia_contracts.h`). Antes de serializar, `telemetry::applyReadingLimits()` omite `hr`/`spo2`/`temp` fuera de rango y satura `accPeakG` en 16 g.

**Otros hallazgos:**

- Enchufada con BOOT apretado, la placa queda en modo descarga (`boot:0x7 (DOWNLOAD...)` en el log de la ROM) y el firmware no arranca. Hay que soltar BOOT y apretar RST.
- El primer arranque después de eso dio el MLX90614 sin detectar y el MPU6050 con valores sin sentido (6–17 g en reposo). Con un RST volvió todo a la normalidad. Si se repite, revisar el cableado del bus I²C.
- **Wi-Fi que no asocia (causa sin confirmar).** Después de los golpes y de reacomodar los cables, la placa dejó de asociarse a `Dp7` (los otros dispositivos sí). Al principio un ciclo de alimentación lo resolvía, después ni eso ni reiniciar el router. Con el motivo de cada fallo en el log (nuevo en `WifiLink`) se vio `AUTH_EXPIRE` (2) y `AUTH_FAIL` (202): la placa encuentra la red (no es `NO_AP_FOUND`) pero el router no le contesta la autenticación. Es decir, la placa escucha al router y el router no la escucha a ella. Bajar la potencia es la solución habitual de la SuperMini a potencia máxima (19,5 dBm), así que quedó `WIFI_TX_POWER_QDBM = 34` (8,5 dBm). Con eso conectó al primer intento (3 s, −35 dBm) justo después de reiniciar el router, y en el arranque siguiente al tercer intento (~10 s). **No está probado que la causa sea la potencia:** los fallos a 19,5 dBm coincidieron con muchas reconexiones seguidas, que pueden haber hecho que el router la bloqueara un rato. Para confirmarlo hay que comparar las dos potencias en arranques seguidos, con el router estable. Mientras tanto, 8,5 dBm alcanza dentro de una sala (−35 a −41 dBm), pero baja el alcance: revisarlo antes de la red real.
- Además, `WifiLink` reintentaba cada 3 s con `disconnect()` + `begin()`, aunque el intento siguiera en curso (asociación + WPA + DHCP tarda ~3–5 s). Ahora reintenta 3 s después de un fallo informado, o a los 15 s si el intento no terminó.
- El monitor serie solo imprime al arrancar y cuando cambia algo (Wi-Fi, MQTT): para ver el arranque hay que abrir el monitor antes de resetear.

### Prueba contra el gateway

Con `pnpm gateway:init`, `gateway:up` y `gateway:seed`, `secrets.h` con `MQTT_USER = wb-01-24d7cc`, su contraseña de `.gateway/mqtt/devices.json` y la `TELEMETRY_AES_KEY` de `.gateway/.env`.

El broker del gateway se publica solo en loopback (ADR 0014: abrirlo a la red es otra decisión, MQTT va sin TLS). Para la prueba se usó **un puente TCP temporal de laboratorio** en la notebook (`<IP de la notebook>:1885` → `127.0.0.1:1884`), que solo aceptaba la IP de la placa y se cerró al terminar. No cambia la configuración del gateway ni queda en el repo.

| Prueba                                                   | Resultado                                                                                                                           |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| Conexión con credenciales propias                        | ✅ Mosquitto: `connected ... as wb-01-24d7cc (u'wb-01-24d7cc')`, suscripción a `.../cmd` aceptada                                   |
| Lecturas → API → PostgreSQL                              | ✅ descifradas con la clave del gateway y guardadas en `telemetry_readings`, `seq` seguido, ~350 ms entre la medición y el guardado |
| Llamado desde la cuenta `vitalia-api`                    | ✅ `G-001` / `Gateway OK` en el OLED                                                                                                |
| La pulsera escribiendo un comando (en el tópico de otra) | ✅ rechazado: `Not authorized`                                                                                                      |
| `pnpm gateway:mqtt-check` (pulseras simuladas)           | ✅ anónimos y contraseñas incorrectas rechazados, aislamiento de lectura, escrituras cruzadas con PUBACK `0x87`                     |
| Filtro del puente                                        | ✅ al cambiar la IP de la placa (reinicio del router) el puente la rechazó hasta reconfigurarlo                                     |

Pendiente para la red real (Fase 4, RUT956): cómo se expone el broker a la VLAN de las pulseras (bind, TLS o red aislada) y NTP local. Hasta entonces, la pulsera física solo llega al gateway con un puente como este.

> Actualización (25/10, ADR 0018): el gateway ahora tiene `GATEWAY_MQTT_BIND` para publicar el broker en la interfaz de la VLAN de las pulseras, sin puente.

---

## Prueba del MAX30102 (26/10)

**Señal cruda (21/10).** `sensors::PulseOx` con 100 muestras/s promediadas de a 4 = 25 muestras/s, rojo + IR, pulso de 411 µs:

- Detectado al arrancar (`MAX30102:OK`) y entregando 25 muestras/s.
- IR ≈ 110 000 con el dedo apoyado y ≈ 540 sin dedo.
- Perfusión (RMS/DC del IR) de 0,2–1,2 % con el dedo quieto y de 1,7–9 % con movimiento: es lo que usa el filtro de calidad.

**Algoritmo (`lib/ppg`, pura, con 11 tests native sobre señales sintéticas).** Calcula la DC con una media móvil de 1 s y suaviza el AC. Detecta los latidos con umbral sobre el RMS y período refractario. El BPM es la mediana de los intervalos, y el SpO2 sale de R con la curva de Maxim. Sin dedo, con perfusión fuera de 0,1–2 % o con latidos irregulares, no hay valor y la lectura omite `hr`/`spo2`. Antes de flashear se pasó la captura del 21/10 por el estimador, en local y sin versionarla: dio 82–94 lpm y 99–100 % en los tramos quietos, y nada con movimiento o sin dedo.

**En la placa (26/10).** Dedo apoyado en la protoboard, con una smartband de referencia (82–87 lpm, 99 %) y 3 min de lecturas en `fw:mqtt-check`:

| Tramo                 | Placa                                                                         | Smartband       |
| :-------------------- | :---------------------------------------------------------------------------- | :-------------- |
| Quieto, primer minuto | 73–83 lpm (casi siempre 79–83), SpO₂ 97–100 %. Con valor en 17 de 23 lecturas | 82–87 lpm, 99 % |
| Movimiento            | sin `hr`/`spo2` en las 13 lecturas                                            | —               |
| Quieto otra vez       | 83–89 lpm, SpO₂ 99–100 %. Con valor en 9 de 9                                 | 82–87 lpm, 99 % |
| Dedo levantado        | sin `hr`/`spo2`                                                               | —               |

Las 60 lecturas descifraron y validaron contra el contrato. En el OLED se vio `83–88lpm 99–100%`.

**Qué falta (con la pulsera):**

1. En el primer minuto el BPM dio algo bajo (~79 contra 82–87). Comparar más tiempo y contra un oxímetro de dedo, que es más exacto que una smartband.
2. Cobertura: con el dedo quieto, ~1 de cada 4 lecturas sale sin valor. Es el filtro siendo prudente (`PPG_HOLD_MS`, dispersión de intervalos). Se puede ajustar o subir a 50 muestras/s, pero recién con el sensor en la muñeca.
3. SpO2: la curva es la genérica de Maxim. Calibrarla de verdad necesita valores bajos de referencia, que no se pueden generar en el laboratorio: queda como indicador.

---

## Demo completa contra el gateway y estado de la pulsera (26/10)

**Demo sin puente.** Gateway en Docker con `GATEWAY_MQTT_BIND`/`GATEWAY_HTTP_BIND` en la IP de la notebook (ADR 0018) y `secrets.h` apuntando al broker del gateway (puerto 1884) con las credenciales propias de `wb-01-24d7cc`. La pulsera publicó directo al gateway, con Backoffice y TV publicados en la red local. Recorrido: alta del paciente, asignación de la pulsera, lecturas en vivo en la consola, llamado en la TV y en el OLED.

Se encontraron dos problemas:

1. Al finalizar el turno, el OLED seguía mostrando `TE LLAMAN` (la API solo publicaba `SHOW_TICKET`, consecuencia abierta del ADR 0015).
2. Sin llamado, el OLED mostraba datos de diagnóstico (IP, aceleración) en vez de algo útil para el paciente que sigue esperando con la pulsera.

**Solución ([ADR 0021](../../docs/adr/0021-estado-de-la-pulsera-por-comandos.md)).** Cuatro comandos con el estado completo (`ASSIGN_TICKET`, `SHOW_TICKET`, `CLEAR_TICKET`, `RELEASE_WEARABLE`), reenvío del estado desde la API cuando la pulsera vuelve después de más de 15 s sin lecturas, vencimiento local del llamado a los 30 min y pantalla del paciente con el código del turno, BPM/SpO2 y temperatura (sin IP, sin nombre).

**En la placa (26/10).** Mismo gateway, un turno de prueba con datos simulados:

| Paso en el Backoffice | Comando recibido   | OLED                              |
| :-------------------- | :----------------- | :-------------------------------- |
| Asignar la pulsera    | `ASSIGN_TICKET`    | `Turno B-003` + signos en vivo    |
| Llamar                | `SHOW_TICKET`      | `TE LLAMAN`, código y consultorio |
| Pasar a atención      | `CLEAR_TICKET`     | vuelve a `Turno B-003` + signos   |
| Finalizar             | `RELEASE_WEARABLE` | `Vitalia` + signos                |

Tests: firmware native 62/62, API 120/120 (Node 24, con el recorrido de los cuatro comandos en la integración).

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

**El firmware actual** arma una `TelemetryReading` del contrato cada 3 s, la publica cifrada por MQTT
y la expone por HTTP (acelerómetro, temperatura, MAX30102, OLED, Wi-Fi, NTP). Recibe los comandos de la API (ADR 0021).

Al arrancar, el monitor serie muestra `wearableId: wb-01-24d7cc  arranque: N`, después
`WiFi OK`, `NTP OK` y `MQTT OK`. Recién con NTP aparecen lecturas.

- OLED: caída reciente > llamado > pantalla del paciente (`Turno <código>` o `Vitalia`, BPM/SpO2 y temperatura, `SIN RED` sin broker). La IP se ve en el monitor serie, `/status` y `wearable-pti.local`.
- Servidor HTTP en el puerto 80:
  - `http://<IP>/` → página web con telemetría en vivo (fetch cada 1 s, sin recursos
    externos, funciona sin internet).
  - `http://<IP>/data` → la última `TelemetryReading`, tal cual se va a publicar por MQTT
    (503 hasta tener hora NTP). Sin `hr`/`spo2` cuando no hay medición válida. `seq` crece cada 3 s y salta
    de bloque en cada reinicio.
  - `http://<IP>/status` → diagnóstico: sensores, NTP, arranque, RSSI, temperatura de piel.
  - `http://wearable-pti.local/` → lo mismo vía mDNS.
- Detección de caída (Hito 8, sin calibrar): caída libre (< 0,4 g) → impacto (> 2,8 g) → 2 s de inmovilidad. Al confirmarse, la lectura con `fall: true` se publica en el momento (no espera el ciclo de 3 s) y el OLED y la página muestran CAÍDA durante 5 s. La página muestra "impacto" si hubo un golpe que no terminó en caída.
- Fiebre (solo indicador del OLED): temperatura central estimada > 38.0 °C (offset provisional +1.2, ver arriba). La alerta la decide la API.
- En la universidad: cambiar SSID/PASS en `src/secrets.h`.
- **Requisito de red:** notebook y dispositivo en el mismo SSID **sin client isolation**.
  Hotspots de celular y redes guest suelen bloquear el tráfico device-to-device →
  usar router de laboratorio propio o hotspot con aislamiento de clientes desactivado.

Los sketches anteriores de cada hito (escáner I²C, OLED, MPU6050, calibración MLX90614,
asociación Wi-Fi) están en el historial de git — `git log --oneline -- apps/wearable-firmware-poc` y
`git show <commit>:apps/wearable-firmware-poc/src/main.cpp` (después del `nx import` las rutas
del historial incluyen el prefijo `apps/wearable-firmware-poc/`).
