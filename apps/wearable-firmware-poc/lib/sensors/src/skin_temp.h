#pragma once
/**
 * MLX90614: temperatura de piel de la muñeca y estimación de la central con el offset
 * PROVISIONAL de AGENTS.md §7 (la curva real espera a la carcasa).
 */
#include <Adafruit_MLX90614.h>
#include <Wire.h>
#include <math.h>

namespace sensors {

class SkinTemp {
 public:
  bool begin(TwoWire& wire, uint8_t address, float skinToCoreOffsetC);
  /** Lee objeto y ambiente. Una lectura fuera de rango no pisa la última válida. */
  bool read();
  bool isHealthy() const { return healthy_; }
  float skinC() const { return skinC_; }
  float ambientC() const { return ambientC_; }
  /** Temperatura clínica estimada: `temp` del contrato. */
  float coreEstC() const { return isnan(skinC_) ? NAN : skinC_ + offsetC_; }

 private:
  Adafruit_MLX90614 mlx_;
  bool started_ = false;
  bool healthy_ = false;
  float offsetC_ = 0.0f;
  float skinC_ = NAN;
  float ambientC_ = NAN;
};

}  // namespace sensors
