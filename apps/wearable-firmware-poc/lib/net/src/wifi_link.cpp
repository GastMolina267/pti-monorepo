#include "wifi_link.h"

#include <Arduino.h>
#include <WiFi.h>

namespace net {

namespace {

// Los escribe la tarea de eventos de Wi-Fi; el loop() solo los lee.
volatile uint32_t failures = 0;
volatile uint8_t lastReason = 0;

void onDisconnected(arduino_event_id_t, arduino_event_info_t info) {
  uint8_t reason = info.wifi_sta_disconnected.reason;
  if (reason == WIFI_REASON_ASSOC_LEAVE) return;  // el disconnect() propio de connect()
  lastReason = reason;
  failures = failures + 1;
}

}  // namespace

void WifiLink::begin(const char* ssid, const char* pass, int8_t txPowerQuarterDbm) {
  ssid_ = ssid;
  pass_ = pass;
  txPower_ = txPowerQuarterDbm;
  WiFi.onEvent(onDisconnected, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  connect();
}

void WifiLink::connect() {
  lastAttemptMs_ = millis();
  WiFi.disconnect(true, true);
  delay(50);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  // Antes de begin(). En la SuperMini, la potencia máxima coincidió con fallos de autenticación.
  WiFi.setTxPower(static_cast<wifi_power_t>(txPower_));
  WiFi.begin(ssid_, pass_);
  Serial.printf("WiFi: conectando a \"%s\"...\n", ssid_);
}

bool WifiLink::connected() const { return WiFi.status() == WL_CONNECTED; }

LinkEvent WifiLink::loop(uint32_t nowMs, uint32_t retryMs, uint32_t attemptTimeoutMs) {
  const uint32_t f = failures;
  if (f != seenFailures_) {
    seenFailures_ = f;
    failedSinceAttempt_ = true;
    const uint8_t reason = lastReason;
    Serial.printf("WiFi: falló (motivo %u: %s)\n", reason,
                  WiFi.disconnectReasonName(static_cast<wifi_err_reason_t>(reason)));
  }
  if (connected()) {
    if (wasConnected_) return LinkEvent::None;
    wasConnected_ = true;
    return LinkEvent::Connected;
  }
  LinkEvent event = wasConnected_ ? LinkEvent::Disconnected : LinkEvent::None;
  wasConnected_ = false;
  const uint32_t elapsed = nowMs - lastAttemptMs_;
  if (elapsed >= (failedSinceAttempt_ ? retryMs : attemptTimeoutMs)) {
    if (!failedSinceAttempt_) Serial.println(F("WiFi: el intento no terminó, se reinicia"));
    lastAttemptMs_ = nowMs;
    failedSinceAttempt_ = false;
    connect();
  }
  return event;
}

}  // namespace net
