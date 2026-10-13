#include "reading.h"

#include <ArduinoJson.h>
#include <stdio.h>

#include "vitalia_contracts.h"

namespace telemetry {

namespace {

// Los decimales se fijan con snprintf y se insertan crudos (serialized) para que el JSON
// sea idéntico en el ESP32 y en native, sin depender de cómo ArduinoJson imprime floats.
void putFixed(JsonDocument& doc, const char* key, float value, int decimals, char* buf, size_t len) {
  snprintf(buf, len, "%.*f", decimals, static_cast<double>(value));
  doc[key] = serialized(buf);
}

}  // namespace

size_t serializeReading(const Reading& reading, char* out, size_t outLen) {
  JsonDocument doc;
  char tempBuf[12];
  char accBuf[12];

  doc["wearableId"] = reading.wearableId;
  doc["seq"] = reading.seq;
  doc["ts"] = reading.tsMs;
  if (reading.hr) doc["hr"] = *reading.hr;
  if (reading.spo2) doc["spo2"] = *reading.spo2;
  if (reading.temp) putFixed(doc, "temp", *reading.temp, 1, tempBuf, sizeof(tempBuf));
  if (reading.accPeakG) putFixed(doc, "accPeakG", *reading.accPeakG, 2, accBuf, sizeof(accBuf));
  doc["fall"] = reading.fall;

  if (measureJson(doc) >= outLen) return 0;
  return serializeJson(doc, out, outLen);
}

uint64_t composeSeq(uint32_t boot, uint32_t counter) {
  constexpr uint32_t kCounterMask = (1UL << vitalia::SEQ_BOOT_SHIFT) - 1;
  return (static_cast<uint64_t>(boot) << vitalia::SEQ_BOOT_SHIFT) | (counter & kCounterMask);
}

bool formatWearableCode(char* out, size_t outLen, int number, const uint8_t mac[6]) {
  if (number < vitalia::WEARABLE_NUMBER_MIN || number > vitalia::WEARABLE_NUMBER_MAX) return false;
  int n = snprintf(out, outLen, "wb-%02d-%02x%02x%02x", number, mac[3], mac[4], mac[5]);
  return n > 0 && static_cast<size_t>(n) < outLen;
}

}  // namespace telemetry
