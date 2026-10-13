/**
 * Firmware del wearable IoMT de Vitalia (ESP32-C3 SuperMini).
 *
 * Orquestación: muestrea sensores, arma una TelemetryReading del contrato cada 3 s y la
 * expone por HTTP (/data) hasta que exista MQTT (Hito 6b), que va a publicar lo mismo.
 * La lógica está en lib/ (AGENTS.md §5): telemetry y fall_detection son puras y se
 * testean sin placa (pnpm fw:test).
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
#include "config.h"
#include "http_demo.h"
#include "identity.h"
#include "impact_detector.h"
#include "imu.h"
#include "oled.h"
#include "peak_tracker.h"
#include "reading.h"
#include "secrets.h"  // WEARABLE_NUMBER, Wi-Fi, NTP_SERVER… (no versionado)
#include "skin_temp.h"
#include "status_led.h"
#include "vitalia_contracts.h"
#include "wifi_link.h"

static_assert(WEARABLE_NUMBER >= vitalia::WEARABLE_NUMBER_MIN &&
                  WEARABLE_NUMBER <= vitalia::WEARABLE_NUMBER_MAX,
              "WEARABLE_NUMBER (secrets.h) tiene que estar entre 1 y 99 (ADR 0011)");

// ---------------- Módulos ----------------
sensors::Imu imu;
sensors::SkinTemp skinTemp;
net::WifiLink wifi;
ui::Oled oled(Wire, I2C_CLOCK_HZ);
ui::StatusLed led(PIN_LED);
telemetry::PeakTracker accPeak;
fall_detection::ImpactDetector impact;

// ---------------- Estado ----------------
char deviceId[telemetry::WEARABLE_ID_LEN] = "wb-00-000000";
uint32_t bootCount = 0;
uint32_t readingCounter = 0;  // se reinicia en cada arranque; seq = boot << 24 | contador
char lastReadingJson[256] = {0};
bool hasReading = false;

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
  r.fall = impact.take();  // solo se consume con hora válida: una caída no se pierde
  if (skinTemp.isHealthy()) r.temp = skinTemp.coreEstC();
  // hr / spo2: vacíos hasta el Hito 5 (MAX30102).

  size_t n = telemetry::serializeReading(r, lastReadingJson, sizeof(lastReadingJson));
  hasReading = n > 0;
  if (!hasReading) Serial.println(F("ERROR: la lectura no entra en el buffer"));
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
  doc["impact_recent"] = impact.recentImpact(now, FALL_DISPLAY_MS);
  serializeJson(doc, out);
  return true;
}

// ---------------- OLED ----------------
static void renderOled(uint32_t now) {
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

  const char* event = impact.recentImpact(now, FALL_DISPLAY_MS) ? "CAIDA" : "ok";
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

  // --- Sensores ---
  if (now - lastImu >= IMU_PERIOD_MS) {
    lastImu = now;
    if (imu.read()) {
      accPeak.update(imu.magnitudeG());
      impact.update(imu.magnitudeG(), now);
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
  if (now - lastOled >= OLED_PERIOD_MS) {
    lastOled = now;
    renderOled(now);
  }
}
