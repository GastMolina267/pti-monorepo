#include "skin_temp.h"

namespace sensors {

bool SkinTemp::begin(TwoWire& wire, uint8_t address, float skinToCoreOffsetC) {
  offsetC_ = skinToCoreOffsetC;
  started_ = mlx_.begin(address, &wire);
  healthy_ = false;  // recién es sano con la primera lectura válida
  return started_;
}

bool SkinTemp::read() {
  if (!started_) return false;
  float obj = mlx_.readObjectTempC();
  float amb = mlx_.readAmbientTempC();
  // Rango del sensor (-20..380 °C): fuera de eso es un error de bus, no una medición.
  healthy_ = !isnan(obj) && obj >= -20.0f && obj <= 380.0f;
  if (!healthy_) return false;
  skinC_ = obj;
  ambientC_ = amb;
  return true;
}

}  // namespace sensors
