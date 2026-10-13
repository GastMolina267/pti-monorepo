#pragma once
/** MPU6050: magnitud de la aceleración en g (para accPeakG y la detección de caídas). */
#include <Adafruit_MPU6050.h>
#include <Wire.h>
#include <math.h>

namespace sensors {

class Imu {
 public:
  bool begin(TwoWire& wire, uint8_t address);
  /** Lee una muestra. Devuelve false (y queda no sano) si el sensor no responde. */
  bool read();
  bool isHealthy() const { return healthy_; }
  /** |a| en g de la última lectura válida (NAN si nunca hubo una). */
  float magnitudeG() const { return magnitudeG_; }

 private:
  Adafruit_MPU6050 mpu_;
  bool started_ = false;
  bool healthy_ = false;
  float magnitudeG_ = NAN;
};

}  // namespace sensors
