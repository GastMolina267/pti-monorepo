#include "identity.h"

#include <Preferences.h>
#include <WiFi.h>

#include "reading.h"

namespace net {

bool deviceCode(char* out, size_t outLen, int wearableNumber) {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  return telemetry::formatWearableCode(out, outLen, wearableNumber, mac);
}

uint32_t nextBootCount() {
  Preferences prefs;
  prefs.begin("vitalia", false);
  uint32_t boot = prefs.getUInt("boot", 0) + 1;
  prefs.putUInt("boot", boot);
  prefs.end();
  return boot;
}

}  // namespace net
