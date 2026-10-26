#pragma once
/**
 * Frescura de las muestras del MAX30102. El estimador cuenta el tiempo en muestras: si el
 * sensor deja de entregarlas (bus I²C, sensor colgado), sus valores nunca vencen solos.
 * El firmware alimenta este watchdog con millis() y, vencido, reinicia el estimador y marca
 * el sensor como no sano. Sin Arduino: se testea en native.
 */
#include <stdint.h>

namespace ppg {

class SampleWatchdog {
 public:
  explicit SampleWatchdog(uint32_t staleMs) : staleMs_(staleMs) {}
  /** Llegaron muestras en `now` (ms). */
  void feed(uint32_t now) {
    last_ = now;
    fed_ = true;
  }
  /** true si nunca llegaron muestras o pasaron más de staleMs desde la última (con desborde de millis). */
  bool stale(uint32_t now) const { return !fed_ || now - last_ > staleMs_; }

 private:
  uint32_t staleMs_;
  uint32_t last_ = 0;
  bool fed_ = false;
};

}  // namespace ppg
