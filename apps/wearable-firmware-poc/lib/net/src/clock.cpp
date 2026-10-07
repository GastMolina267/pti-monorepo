#include "clock.h"

#include <Arduino.h>
#include <sys/time.h>
#include <time.h>

namespace net {

namespace {
// 2024-01-01T00:00:00Z: antes de sincronizar, el reloj del ESP32 arranca en 1970.
constexpr time_t kMinValidEpoch = 1704067200;
}  // namespace

void startNtp(const char* server) { configTime(0, 0, server); }

bool timeValid() { return time(nullptr) > kMinValidEpoch; }

uint64_t nowMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return static_cast<uint64_t>(tv.tv_sec) * 1000ULL + static_cast<uint64_t>(tv.tv_usec / 1000);
}

}  // namespace net
