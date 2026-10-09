#pragma once
/** Pico de |a| (g) entre dos lecturas publicadas: `accPeakG` del contrato. */
#include <optional>

namespace telemetry {

class PeakTracker {
 public:
  void update(float accelG) {
    if (!hasSample_ || accelG > peak_) peak_ = accelG;
    hasSample_ = true;
  }

  /** Devuelve el pico del intervalo (vacío si no hubo muestras) y empieza uno nuevo. */
  std::optional<float> take() {
    std::optional<float> result;
    if (hasSample_) result = peak_;
    hasSample_ = false;
    peak_ = 0.0f;
    return result;
  }

 private:
  float peak_ = 0.0f;
  bool hasSample_ = false;
};

}  // namespace telemetry
