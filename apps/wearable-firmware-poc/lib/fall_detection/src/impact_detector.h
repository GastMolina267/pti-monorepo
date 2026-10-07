#pragma once
/**
 * Detección de caídas por impacto: |a| > umbral (vitalia::FALL_IMPACT_G = 2,8 g).
 * Sin Arduino: el tiempo entra por parámetro, así se testea en native.
 *
 * Hito 8: agregar caída libre previa (~0,4 g) y ventana de inmovilidad (~2 s) y
 * calibrar con el hardware real (AGENTS.md §7).
 */
#include <stdint.h>

#include "vitalia_contracts.h"

namespace fall_detection {

class ImpactDetector {
 public:
  explicit ImpactDetector(float thresholdG = vitalia::FALL_IMPACT_G) : thresholdG_(thresholdG) {}

  /** Una muestra del IMU: magnitud de la aceleración en g y `millis()` del momento. */
  void update(float accelG, uint32_t nowMs) {
    if (accelG > thresholdG_) {
      pending_ = true;
      hasImpact_ = true;
      lastImpactMs_ = nowMs;
    }
  }

  /** `fall` de la próxima lectura: true si hubo impacto desde la anterior. Limpia el flag. */
  bool take() {
    bool fall = pending_;
    pending_ = false;
    return fall;
  }

  /** Para la UI: hubo un impacto en los últimos `windowMs`. */
  bool recentImpact(uint32_t nowMs, uint32_t windowMs) const {
    return hasImpact_ && nowMs - lastImpactMs_ <= windowMs;
  }

 private:
  float thresholdG_;
  bool pending_ = false;
  bool hasImpact_ = false;
  uint32_t lastImpactMs_ = 0;
};

}  // namespace fall_detection
