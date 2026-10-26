#pragma once
/**
 * Frecuencia cardíaca y SpO2 a partir de la señal PPG del MAX30102 (Hito 5).
 *
 *   1. Dedo: con IR < fingerIrMin no hay medición (se reinicia todo).
 *   2. Filtro: DC = media móvil centrada de 1 s; AC = muestra − DC, suavizada con una media
 *      de 4 muestras (pasa-bajos ~6 Hz).
 *   3. Latidos: máximos del pulso (AC invertida: en sístole llega menos luz) por encima de
 *      beatThreshold × RMS, con un período refractario de minBeatMs. BPM = 60 000 / mediana
 *      de los últimos intervalos, si son al menos minIntervals y regulares (MAD/mediana).
 *   4. SpO2: R = (RMS/DC)rojo / (RMS/DC)IR y la curva de Maxim −45,06R² + 30,354R + 94,845.
 *      Si el rojo no tiene DC o pulso (R no es finito y positivo), hay BPM pero no SpO2.
 *   5. Calidad: la perfusión (RMS/DC del IR) tiene que estar entre perfusionMin y
 *      perfusionMax. En la placa, la señal limpia dio 0,35–1,2 % y el movimiento 2,4–5,8 %.
 *      Si falla, no hay valores: la lectura los omite (contrato) en vez de mandar ruido.
 *   6. Retención: con latidos irregulares se conserva el último valor válido hasta holdMs
 *      (en muestras); pasado ese tiempo sin latidos regulares, se borra.
 *
 * El tiempo se cuenta en muestras (sampleRateHz), no con millis(): el firmware lee la FIFO
 * en tandas y todas las muestras de una tanda llegan con el mismo instante. Sin Arduino:
 * se testea en native con señales sintéticas. Los valores por defecto son el punto de
 * partida; el firmware los pasa desde config.h.
 */
#include <stdint.h>

#include <optional>

namespace ppg {

struct PulseOxParams {
  uint32_t fingerIrMin = 50000;
  uint16_t sampleRateHz = 25;      // muestras/s que entrega el sensor (ya promediadas)
  uint32_t warmupMs = 2000;        // después de apoyar el dedo, hasta que el filtro se asienta
  float perfusionMin = 0.001f;     // 0,1 %
  float perfusionMax = 0.02f;      // 2 %: arriba es movimiento
  float beatThreshold = 0.8f;      // fracción del RMS que tiene que superar un latido
  uint32_t minBeatMs = 300;        // 200 BPM
  uint32_t maxBeatMs = 2000;       // 30 BPM
  uint8_t minIntervals = 5;
  float maxIntervalSpread = 0.15f;  // MAD / mediana de los intervalos
  uint32_t holdMs = 5000;           // un latido irregular no borra el último valor válido
};

class PulseOxEstimator {
 public:
  explicit PulseOxEstimator(const PulseOxParams& p = PulseOxParams()) : p_(p) { reset(); }

  /** Una muestra del sensor, en orden. */
  void push(uint32_t ir, uint32_t red);

  std::optional<uint16_t> hr() const { return hr_; }
  std::optional<uint8_t> spo2() const { return spo2_; }
  bool fingerPresent() const { return finger_; }
  /** RMS/DC del IR (0,005 = 0,5 %). 0 sin dedo o durante el calentamiento. */
  float perfusion() const { return perfusion_; }
  /** R de la última medición válida o en curso (diagnóstico); 0 si el rojo no sirve. */
  float ratio() const { return ratio_; }

  void reset();

 private:
  static constexpr uint8_t kMaxWindow = 64;  // 1 s a hasta 64 muestras/s
  static constexpr uint8_t kSmooth = 4;
  static constexpr uint8_t kMaxIntervals = 8;

  uint32_t msToSamples(uint32_t ms) const { return ms * p_.sampleRateHz / 1000; }
  void clearBeats();
  void updateValues();

  PulseOxParams p_;
  uint8_t window_ = 25;

  // Ventana cruda para la DC centrada.
  uint32_t irBuf_[kMaxWindow];
  uint32_t redBuf_[kMaxWindow];
  uint64_t irSum_ = 0;
  uint64_t redSum_ = 0;
  uint8_t head_ = 0;
  uint8_t filled_ = 0;

  // Suavizado del AC.
  float irSmooth_[kSmooth];
  float redSmooth_[kSmooth];
  uint8_t smoothHead_ = 0;

  // RMS (media exponencial de AC²) y DC de cada canal.
  float irMs_ = 0.0f;
  float redMs_ = 0.0f;
  float irDc_ = 0.0f;
  float redDc_ = 0.0f;

  // Detección de máximos (pulso = −AC del IR).
  float prev2_ = 0.0f;
  float prev1_ = 0.0f;
  uint32_t n_ = 0;            // muestras desde que se apoyó el dedo
  bool hasLastBeat_ = false;
  float lastBeat_ = 0.0f;              // posición (en muestras, con fracción) del último latido
  float intervals_[kMaxIntervals];     // en muestras
  uint8_t intervalCount_ = 0;
  uint8_t intervalHead_ = 0;

  bool finger_ = false;
  float perfusion_ = 0.0f;
  float ratio_ = 0.0f;
  std::optional<uint16_t> hr_;
  std::optional<uint8_t> spo2_;
  uint32_t lastValidSample_ = 0;
};

/** Curva de Maxim (spo2_algorithm de la referencia del MAX30102), recortada a 0–100. */
float spo2FromRatio(float r);

}  // namespace ppg
