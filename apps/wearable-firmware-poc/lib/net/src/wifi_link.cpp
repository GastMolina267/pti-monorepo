#include "wifi_link.h"

#include <Arduino.h>
#include <WiFi.h>

namespace net {

void WifiLink::begin(const char* ssid, const char* pass) {
  ssid_ = ssid;
  pass_ = pass;
  connect();
}

void WifiLink::connect() {
  WiFi.disconnect(true, true);
  delay(50);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid_, pass_);
  Serial.printf("WiFi: conectando a \"%s\"...\n", ssid_);
}

bool WifiLink::connected() const { return WiFi.status() == WL_CONNECTED; }

LinkEvent WifiLink::loop(uint32_t nowMs, uint32_t retryMs) {
  if (connected()) {
    if (wasConnected_) return LinkEvent::None;
    wasConnected_ = true;
    return LinkEvent::Connected;
  }
  LinkEvent event = wasConnected_ ? LinkEvent::Disconnected : LinkEvent::None;
  wasConnected_ = false;
  if (nowMs - lastAttemptMs_ >= retryMs) {
    lastAttemptMs_ = nowMs;
    connect();
  }
  return event;
}

}  // namespace net
