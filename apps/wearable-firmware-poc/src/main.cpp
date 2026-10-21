/**
 * Firmware del wearable IoMT de Vitalia (ESP32-C3 SuperMini).
 *
 * Orquestación: muestrea sensores y cada 3 s arma una TelemetryReading del contrato, la
 * cifra con AES-256-GCM y la publica por MQTT con QoS 1 (Hitos 6b y 7). Una caída
 * confirmada (Hito 8) se publica en el momento, sin esperar el ciclo. También la expone
 * por HTTP (/data) para la demo. La lógica está en lib/ (AGENTS.md §5): telemetry,
 * fall_detection y envelope son puras y se testean sin placa (pnpm fw:test).
 *
 * Nada de delay() bloqueante en loop() (AGENTS.md §8). Bus I²C a 100 kHz siempre.
 */
#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <string.h>

#include "clock.h"
#include "command.h"
#include "config.h"
#include "envelope.h"
#include "gcm.h"
#include "http_demo.h"
#include "identity.h"
#include "fall_detector.h"
#include "imu.h"
#include "mqtt_link.h"
#include "oled.h"
#include "peak_tracker.h"
#include "reading.h"
#include "secrets.h"  // WEARABLE_NUMBER, Wi-Fi, NTP_SERVER… (no versionado)
#include "skin_temp.h"
#include "status_led.h"
#include "vitalia_contracts.h"
#include "wifi_link.h"

// Un secrets.h anterior al ADR 0011 no lo trae: mejor este mensaje que "not declared in this scope".
#ifndef WEARABLE_NUMBER
#error "Falta WEARABLE_NUMBER en secrets.h (ver secrets.h.example, ADR 0011)"
#endif
static_assert(WEARABLE_NUMBER >= vitalia::WEARABLE_NUMBER_MIN &&
                  WEARABLE_NUMBER <= vitalia::WEARABLE_NUMBER_MAX,
              "WEARABLE_NUMBER (secrets.h) tiene que estar entre 1 y 99 (ADR 0011)");
#ifndef TELEMETRY_AES_KEY_HEX
#error "Falta TELEMETRY_AES_KEY_HEX en secrets.h (ver secrets.h.example, ADR 0006)"
#endif
// Solo desarrollo: además del sobre cifrado, publica la lectura en claro en <tópico>/plain.
#ifndef MQTT_DEBUG_PLAINTEXT
#define MQTT_DEBUG_PLAINTEXT 0
#endif

// ---------------- Módulos ----------------
static fall_detection::FallParams fallParams() {
  fall_detection::FallParams p;  // impactG = vitalia::FALL_IMPACT_G (contrato)
  p.freeFallG = FALL_FREE_FALL_G;
  p.freeFallMinMs = FALL_FREE_FALL_MIN_MS;
  p.impactWindowMs = FALL_IMPACT_WINDOW_MS;
  p.settleMs = FALL_SETTLE_MS;
  p.stillMs = FALL_STILL_MS;
  p.stillToleranceG = FALL_STILL_TOLERANCE_G;
  p.requireFreeFall = FALL_REQUIRE_FREE_FALL;
  return p;
}

sensors::Imu imu;
sensors::SkinTemp skinTemp;
net::WifiLink wifi;
ui::Oled oled(Wire, I2C_CLOCK_HZ);
ui::StatusLed led(PIN_LED);
telemetry::PeakTracker accPeak;
fall_detection::FallDetector fall(fallParams());
net::MqttLink mqtt;
commands::CallState callState;  // solo se lee/escribe desde loop()

// ---------------- Estado ----------------
char deviceId[telemetry::WEARABLE_ID_LEN] = "wb-00-000000";
uint32_t bootCount = 0;
uint32_t readingCounter = 0;  // se reinicia en cada arranque; seq = boot << 24 | contador
char lastReadingJson[256] = {0};
bool hasReading = false;

uint8_t aesKey[vitalia::CIPHER_KEY_BYTES];
bool aesKeyOk = false;  // sin clave válida no se publica nada (nunca en claro por accidente)
char dataTopic[80] = {0};
char commandFilter[128] = {0};
char plainTopic[88] = {0};
uint32_t publishedCount = 0;   // lecturas encoladas en MQTT desde el arranque
uint32_t droppedCount = 0;     // lecturas que no se pudieron encolar

// ---------------- MQTT ----------------
/** Cifra y encola la última lectura. Devuelve true si quedó en el outbox de ESP-MQTT. */
static bool publishReading(size_t len) {
  if (!aesKeyOk) return false;  // ya se avisó por serie en setup()
  // Outbox lleno (broker caído): no seguir acumulando en RAM.
  if (mqtt.outboxBytes() > MQTT_OUTBOX_MAX_BYTES) {
    droppedCount++;
    return false;
  }
  char sealed[512];
  size_t n = crypto::seal(aesKey, lastReadingJson, len, sealed, sizeof(sealed));
  if (n == 0 || !mqtt.publish(dataTopic, sealed, vitalia::MQTT_QOS)) {
    droppedCount++;
    Serial.println(F("ERROR: no se pudo cifrar o encolar la lectura"));
    return false;
  }
  publishedCount++;
#if MQTT_DEBUG_PLAINTEXT
  mqtt.publish(plainTopic, lastReadingJson, 0);
#endif
  return true;
}

// ---------------- Lectura del contrato ----------------
static void buildReading() {
  // El pico se toma siempre, así cada lectura cubre solo su intervalo de 3 s.
  std::optional<float> peak = accPeak.take();
  if (!net::timeValid()) return;  // sin hora NTP no hay `ts`: no se arma nada

  telemetry::Reading r;
  strncpy(r.wearableId, deviceId, sizeof(r.wearableId) - 1);
  r.seq = telemetry::composeSeq(bootCount, readingCounter++);
  r.tsMs = net::nowMs();
  r.accPeakG = peak;
  // Se lee sin consumir: la caída se da por entregada recién cuando la lectura queda encolada
  // (abajo). Si no hay hora, el JSON no entra o el outbox está lleno, sale en la próxima.
  r.fall = fall.pending();
  if (skinTemp.isHealthy()) r.temp = skinTemp.coreEstC();
  // hr / spo2: vacíos hasta el Hito 5 (MAX30102).
  telemetry::applyReadingLimits(r);  // fuera de rango la API descarta la lectura entera

  size_t n = telemetry::serializeReading(r, lastReadingJson, sizeof(lastReadingJson));
  hasReading = n > 0;
  if (!hasReading) {
    Serial.println(F("ERROR: la lectura no entra en el buffer"));
    return;
  }
  bool queued = publishReading(n);
  // Sin clave AES no sale nada por MQTT (nunca va a encolar): la caída queda en /data y
  // se consume igual, para que no viaje en todas las lecturas siguientes.
  if (r.fall && (queued || !aesKeyOk)) fall.take();
}

// ---------------- HTTP (demo) ----------------
static bool provideData(String& out) {
  if (!hasReading) return false;
  out = lastReadingJson;
  return true;
}

static bool provideStatus(String& out) {
  JsonDocument doc;
  uint32_t now = millis();
  doc["wearableId"] = deviceId;
  doc["boot"] = bootCount;
  doc["uptime_s"] = now / 1000;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi_dbm"] = WiFi.RSSI();
  doc["ntp"] = net::timeValid();
  doc["sensors"]["mpu6050"] = imu.isHealthy();
  doc["sensors"]["mlx90614"] = skinTemp.isHealthy();
  doc["sensors"]["oled"] = oled.isHealthy();
  if (!isnan(imu.magnitudeG())) doc["accel_g"] = roundf(imu.magnitudeG() * 100) / 100.0;
  if (skinTemp.isHealthy()) {
    doc["temp_skin_c"] = roundf(skinTemp.skinC() * 10) / 10.0;
    doc["temp_ambient_c"] = roundf(skinTemp.ambientC() * 10) / 10.0;
  }
  doc["fall_recent"] = fall.recentFall(now, FALL_DISPLAY_MS);
  doc["impact_recent"] = fall.recentImpact(now, FALL_DISPLAY_MS);  // con o sin caída: para calibrar
  doc["fall_state"] = fall_detection::stateName(fall.state());
  JsonObject m = doc["mqtt"].to<JsonObject>();
  m["topic"] = dataTopic;
  m["connected"] = mqtt.connected();
  m["command_filter"] = commandFilter;
  m["commands_ready"] = mqtt.commandsReady();
  m["aes_key"] = aesKeyOk;
  m["published"] = publishedCount;
  m["acked"] = mqtt.acked();
  m["dropped"] = droppedCount;
  m["outbox_bytes"] = mqtt.outboxBytes();
  m["debug_plaintext"] = MQTT_DEBUG_PLAINTEXT != 0;
  serializeJson(doc, out);
  return true;
}

// ---------------- OLED ----------------
static void renderOled(uint32_t now) {
  // Una caída reciente conserva prioridad local; después vuelve el último llamado.
  if (callState.active() && !fall.recentFall(now, FALL_DISPLAY_MS)) {
    const auto frame = callState.frame(now, mqtt.connected(), CALL_SCROLL_MS);
    oled.show(frame.title, frame.ticket, frame.room);
    return;
  }
  char line0[24], line1[24], line2[24];

  if (wifi.connected()) snprintf(line0, sizeof(line0), "%s", WiFi.localIP().toString().c_str());
  else snprintf(line0, sizeof(line0), "WiFi...");

  if (!net::timeValid()) {
    snprintf(line1, sizeof(line1), "NTP...");
  } else if (skinTemp.isHealthy()) {
    float core = skinTemp.coreEstC();
    snprintf(line1, sizeof(line1), "T %.1fC%s", core, core > FEVER_DISPLAY_THRESHOLD_C ? " FIEBRE" : "");
  } else {
    snprintf(line1, sizeof(line1), "T --");
  }

  const char* event = fall.recentFall(now, FALL_DISPLAY_MS) ? "CAIDA" : "ok";
  if (imu.isHealthy()) snprintf(line2, sizeof(line2), "a %.2fg  %s", imu.magnitudeG(), event);
  else snprintf(line2, sizeof(line2), "a --");

  oled.show(line0, line1, line2);
}

// ---------------- setup / loop ----------------
void setup() {
  led.begin();

  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10);
  Serial.println();
  Serial.println(F("=== Wearable IoMT - Vitalia ==="));

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(I2C_CLOCK_HZ);

  bool oledOk = oled.begin(OLED_I2C_ADDR);
  bool imuOk = imu.begin(Wire, MPU6050_I2C_ADDR);
  bool mlxOk = skinTemp.begin(Wire, MLX90614_I2C_ADDR, SKIN_TO_CORE_OFFSET_C);
  Serial.printf(" OLED:%s  MPU6050:%s  MLX90614:%s\n", oledOk ? "OK" : "--", imuOk ? "OK" : "--",
                mlxOk ? "OK" : "--");

  bootCount = net::nextBootCount();
  net::deviceCode(deviceId, sizeof(deviceId), WEARABLE_NUMBER);  // rango validado por static_assert
  Serial.printf(" wearableId: %s  arranque: %lu\n", deviceId, static_cast<unsigned long>(bootCount));

  // --- MQTT + cifrado ---
  aesKeyOk = envelope::hexToBytes(TELEMETRY_AES_KEY_HEX, aesKey, sizeof(aesKey));
  if (!aesKeyOk) {
    Serial.println(F(" ERROR: TELEMETRY_AES_KEY_HEX inválida (64 hex). No se publica por MQTT."));
  }
  snprintf(dataTopic, sizeof(dataTopic), vitalia::MQTT_TOPIC_DATA_FMT, MQTT_SALA, deviceId);
  snprintf(plainTopic, sizeof(plainTopic), "%s/plain", dataTopic);
  // Cubre también sala1 antes de la primera lectura y cambios de sala: el ID siempre es propio.
  snprintf(commandFilter, sizeof(commandFilter), vitalia::MQTT_TOPIC_CMD_FMT, "+", deviceId);
  if (!mqtt.begin(MQTT_BROKER, MQTT_PORT, deviceId, MQTT_USER, MQTT_PASS, commandFilter)) {
    Serial.println(F(" ERROR: no se pudo inicializar MQTT y la recepción de comandos"));
  }
  Serial.printf(" MQTT: mqtt://%s:%d  tópico %s%s\n", MQTT_BROKER, MQTT_PORT, dataTopic,
                MQTT_DEBUG_PLAINTEXT ? "  (+ /plain EN CLARO, solo desarrollo)" : "");

  wifi.begin(WIFI_SSID, WIFI_PASS);
  http_demo::begin(provideData, provideStatus);
  Serial.println(F(" HTTP en el puerto 80 (/, /data, /status)"));
}

void loop() {
  static uint32_t lastImu = 0, lastTemp = 0, lastOled = 0, lastReading = 0;
  static bool mdnsUp = false, ntpLogged = false;
  uint32_t now = millis();

  // --- Wi-Fi + NTP ---
  switch (wifi.loop(now, WIFI_RETRY_MS)) {
    case net::LinkEvent::Connected:
      Serial.printf("WiFi OK  IP: %s  RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
      Serial.printf("  -> http://%s/   |   http://%s.local/\n", WiFi.localIP().toString().c_str(), MDNS_HOST);
      net::startNtp(NTP_SERVER);
      mqtt.start();  // una sola vez; después ESP-MQTT reconecta solo
      if (!mdnsUp && MDNS.begin(MDNS_HOST)) {
        MDNS.addService("http", "tcp", 80);
        mdnsUp = true;
      }
      break;
    case net::LinkEvent::Disconnected:
      Serial.println(F("WiFi: caído"));
      break;
    case net::LinkEvent::None:
      break;
  }
  if (wifi.connected()) led.on();
  else led.blink(now, 200);

  if (!ntpLogged && net::timeValid()) {
    ntpLogged = true;
    Serial.printf("NTP OK (%s): epoch %llu ms\n", NTP_SERVER, static_cast<unsigned long long>(net::nowMs()));
  }

  http_demo::loop();
  commands::ShowTicket command;
  const bool callUpdated = mqtt.takeCommand(command) && callState.apply(command, now);

  // --- Sensores ---
  if (now - lastImu >= IMU_PERIOD_MS) {
    lastImu = now;
    if (imu.read()) {
      float g = imu.magnitudeG();
      accPeak.update(g);
      bool fallConfirmed = fall.update(g, now);
      static fall_detection::FallState lastFallState = fall_detection::FallState::Idle;
      if (FALL_LOG_TRANSITIONS && fall.state() != lastFallState) {
        Serial.printf("caída: %s -> %s (a=%.2f g)\n", fall_detection::stateName(lastFallState),
                      fall_detection::stateName(fall.state()), g);
      }
      lastFallState = fall.state();
      if (fallConfirmed) {
        // RNF-O1: la alerta no espera hasta 3 s al próximo ciclo. Se publica ya y el ciclo
        // arranca de nuevo desde acá.
        Serial.println(F("CAÍDA confirmada: se publica la lectura ahora"));
        lastReading = now;
        buildReading();
      }
    }
  }
  if (now - lastTemp >= TEMP_PERIOD_MS) {
    lastTemp = now;
    skinTemp.read();
  }

  // --- Lectura del contrato (cada 3 s) ---
  if (now - lastReading >= TELEMETRY_PERIOD_MS) {
    lastReading = now;
    buildReading();
  }

  // --- OLED ---
  if (callUpdated || now - lastOled >= OLED_PERIOD_MS) {
    lastOled = now;
    renderOled(now);
  }
}
