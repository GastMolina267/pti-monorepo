# AGENTS.md — apps/wearable-firmware-poc (Wearable IoMT · ESP32-C3 SuperMini)

Firmware de la pulsera wearable de monitoreo hospitalario en tiempo real (IoMT) de **Vitalia**. Lee los sensores por I²C, detecta caídas en el dispositivo y publica la telemetría cifrada por MQTT al Edge Gateway, donde la consume `apps/api`. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

> **Contratos primero.** Los tópicos MQTT, el sobre cifrado, el payload y los umbrales clínicos son de [`@vitalia/contracts`](../../libs/shared/contracts) y [`docs/04-contratos.md`](../../docs/04-contratos.md). Si el firmware necesita algo distinto, se cambia **primero** el contrato (skill `vitalia-contracts`) y después el firmware y la API. Ver §6.
>
> Proyecto Nx `wearable-firmware-poc` (`scope:wearable`, `type:app`), con dependencia implícita de `contracts`. Estado de la validación de hardware: [`ESTADO.md`](ESTADO.md).

---

## 1. Stack Tecnológico y Entorno

- **Plataforma:** PlatformIO en VS Code
- **Microcontrolador:** ESP32-C3 SuperMini (RISC-V 32-bit single-core @ 160 MHz, 4 MB Flash, 400 KB SRAM)
- **Framework:** Arduino Core para ESP32 (FreeRTOS subyacente)
- **Lenguaje:** C++17
- **Conectividad:** Wi-Fi 802.11 b/g/n (**solo 2.4 GHz**) + MQTT (PubSubClient)
- **Serial / consola:** USB CDC **nativo** a 115200 baudios
- **Cifrado:** AES-256-GCM con el acelerador AES por hardware vía mbedTLS (`mbedtls/gcm.h`)

> **Nota de alcance:** el informe académico describe un ESP32-C5 con Wi-Fi 6 dual-band y TWT. Por falta de stock se implementa sobre **C3**: 2.4 GHz, Wi-Fi 4, sin TWT y sin 802.15.4. Las secciones del informe sobre 5 GHz, TWT y modo mesh/Thread deben corregirse. El acelerador AES-256 por hardware sí está presente en el C3, así que el requisito RNF-O3 se mantiene.

---

## 2. Mapa de Hardware y Pines (Pinout)

Todos los sensores y la pantalla comparten el **mismo bus I²C**.

| Componente                        | Función                            | Pin                           | Dirección I²C |
| :-------------------------------- | :--------------------------------- | :---------------------------- | :------------ |
| **I2C SDA**                       | Bus de datos                       | `GPIO 5`                      | —             |
| **I2C SCL**                       | Bus de reloj                       | `GPIO 6`                      | —             |
| **MAX30102**                      | Pulso (BPM) y SpO2                 | Bus I²C                       | `0x57`        |
| **MLX90614 (GY-906)**             | Temperatura infrarroja corporal    | Bus I²C                       | `0x5A`        |
| **MPU6050**                       | Acelerómetro / giroscopio (caídas) | Bus I²C                       | `0x68`        |
| **SSD1306 OLED**                  | Pantalla 128×32 px                 | Bus I²C                       | `0x3C`        |
| **LED onboard**                   | Estado del dispositivo             | `GPIO 8` (**activo en BAJO**) | —             |
| **Push button** _(opcional)_      | Botón de pánico / asistencia       | `GPIO 3` (`INPUT_PULLUP`)     | —             |
| **Buzzer activo** _(opcional)_    | Señal acústica de llamado          | `GPIO 4`                      | —             |
| **Sense de batería** _(opcional)_ | Divisor resistivo a ADC1           | `GPIO 0` o `GPIO 1`           | —             |

### 2.1 Pines prohibidos y strapping

En el ESP32-C3, **GPIO 2, GPIO 8 y GPIO 9 son pines de strapping**: su nivel al momento del reset define el modo de arranque.

- **GPIO 9** es el pin de BOOT. Si queda en bajo durante el reset, la placa entra en modo descarga y el firmware no arranca. **No usar para nada.**
- **GPIO 8** tiene el LED onboard cableado con resistencia a 3.3 V. Reservado exclusivamente para el LED de estado.
- **GPIO 2** debe estar alto al arrancar. Evitar salvo necesidad real.
- **GPIO 20 / 21** son UART0 (RX/TX). Libres solo si no se usa el puerto serie por hardware.

> El bus I²C **no** va en GPIO 8/9 aunque sea el default de la librería `Wire` en muchos ejemplos del C3. La combinación LED + strapping en esos pines deforma los flancos y hace fallar el arranque de manera intermitente. Por eso se fija explícitamente `Wire.begin(5, 6)`.

### 2.2 Alimentación

- **MAX30102 (módulo violeta, GY-MAX30102):** este módulo está diseñado para **5 V en VIN** (lleva regulador propio y level shifter). A 3.3 V funciona de forma errática o directamente no responde en el escaneo I²C.
  - Durante el desarrollo: alimentar VIN desde el pin `5V` de la SuperMini, que entrega tensión **solo cuando la placa está conectada por USB**.
  - **Problema abierto para la versión a batería:** con LiPo (3.7 V) no hay 5 V disponibles. Hay que resolverlo con un módulo boost 3.7→5 V, o reemplazar el sensor por la variante roja de 3.3 V. Decidir antes de cerrar el diseño de la carcasa.
- **MLX90614, MPU6050 y SSD1306:** 3.3 V, sin conflictos.
- Las líneas SDA/SCL necesitan pull-ups de 4.7 kΩ a 3.3 V. La mayoría de los módulos ya los traen incorporados; con cuatro dispositivos en el bus, los pull-ups quedan en paralelo y la resistencia efectiva baja. Si hay errores de comunicación, desoldar los de alguno de los módulos.

### 2.3 Velocidad del bus I²C

**Fijar el bus a 100 kHz** (`Wire.setClock(100000)`).

El MLX90614 es un dispositivo SMBus y no es confiable por encima de 100 kHz. El MAX30102 rinde mejor a 400 kHz, pero como comparten bus, gana la restricción más estricta. La penalidad es un vaciado más lento del FIFO del MAX30102: compensar leyendo el FIFO con mayor frecuencia en lugar de subir el reloj.

---

## 3. Configuración de PlatformIO

`platformio.ini`:

```ini
[env:esp32-c3-supermini]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
monitor_speed = 115200

; CRÍTICO: sin esto no hay salida por el monitor serie.
; La SuperMini no tiene chip USB-serie: usa USB CDC nativo.
build_flags =
    -DARDUINO_USB_CDC_ON_BOOT=1
    -DARDUINO_USB_MODE=1
    -std=gnu++17

build_unflags = -std=gnu++11

; Versiones fijadas: estas librerías rompen compatibilidad seguido.
lib_deps =
    sparkfun/SparkFun MAX3010x Pulse and Proximity Sensor Library@^1.1.2
    adafruit/Adafruit MLX90614 Library@^2.1.5
    adafruit/Adafruit MPU6050@^2.2.6
    adafruit/Adafruit Unified Sensor@^1.1.14
    adafruit/Adafruit SSD1306@^2.5.9
    adafruit/Adafruit GFX Library@^1.11.9
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^7.0.4
```

### Gotchas del entorno

- **USB CDC:** al subir firmware, el puerto se re-enumera. Si el monitor queda colgado, cerrarlo antes de flashear. Si la placa no aparece, mantener BOOT presionado mientras se conecta el USB.
- **PubSubClient:** el buffer por defecto es de 256 bytes. Un JSON biométrico cifrado en AES-256 y codificado en Base64 lo supera, y la librería **descarta el mensaje en silencio, sin error**. Llamar a `client.setBufferSize(512)` (o más) después de `client.setServer()`.
- **Antena:** la antena PCB de la SuperMini es notoriamente pobre. Si hay desconexiones de Wi-Fi, es el hardware y no el código.
- **Adafruit_SSD1306 y la velocidad del bus:** por defecto el constructor sube el bus I²C a **400 kHz durante cada `display.display()`** (`clkDuring = 400000`) y lo baja después. En un bus compartido con el MLX90614 (SMBus, máx 100 kHz) y 4 dispositivos hand-wired, ese salto **corrompe la transferencia** (píxeles al azar). Fijar el reloj en las dos fases: `Adafruit_SSD1306 display(W, H, &Wire, RST, 100000, 100000);`
- **MLX90614 con EEPROM de configuración corrupta:** _síntoma_ = la temperatura de objeto tiene **error de escala** (p. ej. +28 °C sobre piel a 33 °C, pero solo unos grados sobre superficies a temperatura ambiente); `Ta` lee bien y la emisividad es 1.00. _Causa_ = registro `Config1` (EEPROM `0x25`) alterado — ganancia en ×12.5 en vez de ×100 y bits de signo Ks/KT2 invertidos (leído `0xAFF4`, correcto `0x9FB4`). Puede venir de fábrica (clon), de una escritura interrumpida, de ESD por punta de soldador sin descarga a tierra o de sobrecalentar el encapsulado al soldar. _Fix_ = reescribir `0x25 = 0x9FB4` con el ciclo borrar→escribir de SMBus y **ciclar la alimentación del sensor** (el MLX solo carga la config de EEPROM al arrancar; un reset del ESP32 no alcanza si el sensor sigue con 3V3). Verificar con un volcado de registros. Si la EEPROM no acepta la escritura o el error persiste tras corregir `0x25`, el chip está dañado: reemplazar.
- **MLX90614 / GY-906 — alimentación:** **siempre 3.3 V**, nunca 5 V. Es la variante ESF-BAA de 3 V; 5 V puede dañar el die y su EEPROM.

---

## 4. Comandos de Compilación y Flujo de Trabajo

Desde la raíz del monorepo, vía Nx (regla del [AGENTS.md raíz](../../AGENTS.md)):

```bash
pnpm fw:build      # = pnpm nx run wearable-firmware-poc:pio-build  (pio run)
pnpm fw:upload     # = ...:pio-upload                               (pio run -t upload)
pnpm fw:monitor    # = ...:pio-monitor                              (pio device monitor)
pnpm nx run wearable-firmware-poc:pio-clean
```

Los targets se llaman `pio-*` a propósito: así `pnpm affected` / `pnpm check` no exigen PlatformIO a quien no trabaja con el firmware. No usan caché de Nx porque `src/secrets.h` no se versiona y Nx no lo puede hashear. En CI, el job `firmware` compila con `pio run` cuando cambia este proyecto o `contracts`.

`pio` tiene que estar en el PATH. Si se instaló con la extensión de VS Code, agregar `%USERPROFILE%\.platformio\penv\Scripts`.

Dentro de `apps/wearable-firmware-poc`, con PlatformIO directo:

```bash
# Compilar proyecto
pio run

# Compilar y subir al ESP32-C3 por USB-C
pio run -t upload

# Abrir el monitor serie (115200 baudios)
pio device monitor

# Compilar, subir y abrir el monitor en un solo paso
pio run -t upload && pio device monitor

# Limpiar build
pio run -t clean

# Listar puertos detectados (útil si la placa no aparece)
pio device list
```

---

## 5. Estructura del Proyecto

```
/src
  main.cpp              // setup() + loop(), orquestación
  config.h              // pines, umbrales, constantes (sin secretos)
  secrets.h             // credenciales Wi-Fi, broker, clave AES — NO versionar
/lib
  sensors/              // wrappers de MAX30102, MLX90614, MPU6050
  fall_detection/       // algoritmo de umbral
  crypto/               // AES-256-GCM sobre mbedTLS (sobre { v, iv, ct, tag })
  net/                  // Wi-Fi + MQTT
  ui/                   // OLED, LED, buzzer
/test                   // tests unitarios (pio test)
```

`secrets.h` va en `.gitignore`. Se versiona `secrets.h.example` con las claves vacías.

---

## 6. Contrato MQTT

**Fuente de verdad:** [`libs/shared/contracts/src/lib/telemetry/mqtt.ts`](../../libs/shared/contracts/src/lib/telemetry/mqtt.ts) y [`docs/04-contratos.md`](../../docs/04-contratos.md). Esta sección es un resumen para el firmware. Si no coincide con esos archivos, mandan ellos.

- **Broker:** Mosquitto en el Edge Gateway, puerto **1883** (la VLAN 10 solo permite tráfico a ese puerto). En desarrollo, `pnpm infra:up` levanta Mosquitto en la notebook.
- **Tópico de telemetría (publicación):** `hospital/<sala>/wearable/<id>/data` (`MQTT_TOPICS.wearableData`)
- **Tópico de comandos (suscripción):** `hospital/<sala>/wearable/<id>/cmd` (`MQTT_TOPICS.wearableCommand`)
- **No hay tópico de alertas.** Una caída viaja como `fall: true` dentro de `data`. La API la clasifica con `assessVitals()` y emite `alert:emergency`.
- **QoS 1**, sin `retain`.
- **`<id>` / Client ID:** derivado de la MAC, estable entre reinicios (hoy `wb-24d7cc`). Es el mismo valor que `wearableId`.

Lectura en claro (`TelemetryReading`), antes de cifrar:

```json
{
  "wearableId": "wb-24d7cc",
  "seq": 1532,
  "ts": 1791065563577,
  "hr": 78,
  "spo2": 98,
  "temp": 36.6,
  "accPeakG": 1.02,
  "fall": false
}
```

| Campo      | Unidad   | Notas                                                                                    |
| ---------- | -------- | ---------------------------------------------------------------------------------------- |
| `seq`      | —        | Contador monotónico. La API deduplica por `(wearableId, seq)` (QoS 1 puede repetir)      |
| `ts`       | ms epoch | Hora del wearable (requiere NTP o sincronizar contra el gateway)                         |
| `hr`       | BPM      | Opcional: se omite hasta que el MAX30102 dé una lectura válida (no mandar `null` ni `0`) |
| `spo2`     | %        | Ídem                                                                                     |
| `temp`     | °C       | **Ya compensada** a temperatura clínica estimada (§7), nunca la cruda de piel            |
| `accPeakG` | g        | Pico de magnitud de aceleración del intervalo de publicación                             |
| `fall`     | bool     | `true` si el firmware detectó una caída (impacto > 2,8 g + inmovilidad)                  |

El JSON se cifra con **AES-256-GCM** ([ADR 0006](../../docs/adr/0006-cifrado-aes-256-gcm.md)) y se publica como sobre `EncryptedEnvelope`:

```json
{ "v": 1, "iv": "<12 bytes base64>", "ct": "<base64>", "tag": "<16 bytes base64>" }
```

- IV **aleatorio de 12 bytes por mensaje** (`esp_fill_random`). Nunca reutilizar un IV con la misma clave.
- Clave de 32 bytes = `TELEMETRY_AES_KEY` del `.env` del gateway (64 hex), copiada a `secrets.h`. **Nunca** se escribe literal en el código de aplicación ni en logs.
- Si el tag no valida, el gateway descarta el mensaje.

Comando recibido por `.../cmd` (propuesta Fase 2):

```json
{ "type": "SHOW_TICKET", "ticketCode": "A-024", "consultingRoom": "Cons. 4" }
```

> El botón de pánico y la batería no están en el contrato todavía. Para mandarlos, primero se agregan los campos a `TelemetryReading` en `@vitalia/contracts`.

---

## 7. Umbrales y Parámetros del Algoritmo

Los **umbrales clínicos** de la plataforma están en [`libs/shared/contracts/src/lib/clinical/thresholds.ts`](../../libs/shared/contracts/src/lib/clinical/thresholds.ts) (`CLINICAL_THRESHOLDS`), y la clasificación oficial la hace la API con `assessVitals()`. El firmware los replica en `config.h` solo para lo que decide en el dispositivo: detectar caídas, mostrar estados en el OLED y el LED. Si cambian en contracts, se actualiza `config.h`.

Definidos en `config.h`, no dispersos por el código:

| Parámetro                              | Valor     | Origen                                  |
| :------------------------------------- | :-------- | :-------------------------------------- |
| Umbral de impacto (caída)              | **2.8 g** | Informe, sección de flujo de telemetría |
| Umbral de caída libre previa           | ~0.4 g    | Marco teórico                           |
| Ventana de inmovilidad post-impacto    | 2000 ms   | A calibrar en ensayos                   |
| Frecuencia de muestreo IMU             | 50 Hz     | —                                       |
| Intervalo de publicación de telemetría | 5 s       | Ajustable según autonomía               |
| SpO2 crítico                           | < 90 %    | Marco teórico                           |
| Rango normal BPM                       | 60–100    | Marco teórico                           |
| Temperatura de fiebre                  | > 37.5 °C | Marco teórico                           |
| Latencia máxima de alerta              | 2.0 s     | RNF-O1                                  |

La temperatura del MLX90614 es **superficial de muñeca**, no central. Antes de comparar contra el umbral de fiebre hay que aplicar la curva de compensación. No publicar el valor crudo como si fuera temperatura clínica.

> **Estado de la calibración de temperatura (pendiente):** con el sensor sostenido a mano, la geometría (gap, ángulo, sellado de la cavidad de aire) varía entre mediciones y mete **~1–2 °C de dispersión** que tapa cualquier curva de compensación. La curva `central ≈ f(piel, Ta)` **solo tiene sentido una vez que exista la correa/carcasa que fije la geometría**; calibrar antes es caracterizar el ruido del pulso. Medición representativa asentada (prueba limpia): piel ≈ central − 1.2 °C a ambiente ~23 °C → usar `SKIN_TO_CORE_OFFSET_C = 1.2` **provisional**. En el firmware, tratar la temperatura como **indicador grueso**: banda "normal" amplia y disparar alerta de fiebre recién en **> 38.0 °C** estimados, no 37.5, para no acumular falsos positivos por ruido de medición. El sensor cerrado contra la muñeca puede además autocalentarse con uso sostenido (se observó `Ta` +3.6 °C en 3 min continuos): la carcasa debe disipar o el firmware compensar `Ta` según tiempo encendido.

---

## 8. Convenciones y Restricciones

**No hacer:**

- No usar `delay()` bloqueante en el `loop()`: rompe el heartbeat de MQTT y el muestreo del IMU. Usar `millis()` no bloqueante o tareas de FreeRTOS.
- No tocar GPIO 9 bajo ninguna circunstancia.
- No hacer llamadas de red dentro de una ISR.
- No hardcodear credenciales, SSIDs ni la clave AES fuera de `secrets.h`.
- No imprimir datos biométricos ni la clave por serie en builds de producción; usar una macro de log condicional.
- No subir la frecuencia del bus I²C por encima de 100 kHz.

**Sí hacer:**

- Toda constante numérica va en `config.h`.
- Cada sensor detrás de un wrapper con la misma interfaz (`begin()`, `read()`, `isHealthy()`), para poder mockearlo en tests.
- El firmware debe seguir operando y almacenando en buffer si el broker está caído: la resiliencia offline es requisito, no un extra.

---

## 9. Hitos de Validación del Hardware

Ejecutar en orden. No avanzar al siguiente hasta que el anterior pase.

1. **Escáner I²C.** Debe detectar las cuatro direcciones: `0x57`, `0x5A`, `0x68`, `0x3C`. Si falta alguna, el problema es de cableado o alimentación (revisar en particular los 5 V del MAX30102 violeta), no de software.
2. **OLED.** Mostrar texto estático. Confirma bus y alimentación.
3. **MPU6050.** Volcar aceleración cruda en los tres ejes por serie y verificar ~1 g en reposo sobre el eje vertical.
4. **MLX90614.** Comparar contra un termómetro comercial. Registrar el delta piel-central para armar la curva de compensación.
5. **MAX30102.** Lectura de BPM estable con el dedo apoyado; SpO2 contra un oxímetro comercial.
6. **Wi-Fi + MQTT.** Publicar un `TelemetryReading` en claro y verificar la recepción en el broker con `mosquitto_sub`.
7. **Cifrado.** Activar AES-256-GCM (sobre `{ v, iv, ct, tag }`) y validar que el Gateway descifra correctamente.
8. **Detección de caídas.** Ensayos con el dispositivo en caída controlada sobre superficie acolchada. Calibrar umbral y ventana.
