#pragma once
/**
 * MAX30102 (Hito 5): señal PPG cruda de los LED rojo e infrarrojo. Vacía la FIFO del sensor
 * sin bloquear; el cálculo de BPM y SpO2 va aparte (lib pura, testeable en native).
 * El módulo violeta necesita 5 V en VIN (AGENTS.md §2.2).
 */
#include <MAX30105.h>
#include <Wire.h>

namespace sensors {

struct PulseOxConfig {
  uint8_t ledAmplitude;  // 0x00–0xFF (0x1F ≈ 6,4 mA)
  uint8_t sampleAverage;  // 1, 2, 4, 8, 16, 32
  uint16_t sampleRate;    // muestras/s antes de promediar: 50–3200
  uint16_t pulseWidthUs;  // 69, 118, 215, 411 (más ancho = más resolución)
  uint16_t adcRange;      // 2048, 4096, 8192, 16384 (nA)
  uint32_t fingerIrMin;   // IR mínimo para considerar que hay un dedo apoyado
};

class PulseOx {
 public:
  bool begin(TwoWire& wire, const PulseOxConfig& config);
  /**
   * Lee las muestras nuevas de la FIFO. Llamar seguido: a 25 muestras/s la FIFO (32) se
   * llena en ~1,3 s. `onSample(ir, red)` se llama por cada muestra, en orden.
   */
  template <typename F>
  uint16_t read(F&& onSample) {
    if (!started_) return 0;
    sensor_.check();
    uint16_t n = 0;
    while (sensor_.available()) {
      lastIr_ = sensor_.getFIFOIR();
      lastRed_ = sensor_.getFIFORed();
      sensor_.nextSample();
      onSample(lastIr_, lastRed_);
      n++;
    }
    total_ += n;
    if (n > 0) healthy_ = true;
    return n;
  }
  bool isHealthy() const { return healthy_; }
  bool fingerPresent() const { return healthy_ && lastIr_ >= fingerIrMin_; }
  uint32_t lastIr() const { return lastIr_; }
  uint32_t lastRed() const { return lastRed_; }
  /** Muestras leídas desde begin(): sirve para ver la tasa real en /status. */
  uint32_t totalSamples() const { return total_; }

 private:
  MAX30105 sensor_;
  bool started_ = false;
  bool healthy_ = false;
  uint32_t fingerIrMin_ = 0;
  uint32_t lastIr_ = 0;
  uint32_t lastRed_ = 0;
  uint32_t total_ = 0;
};

}  // namespace sensors
