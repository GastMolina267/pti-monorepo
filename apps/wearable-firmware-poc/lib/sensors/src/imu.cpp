#include "imu.h"

namespace sensors {

namespace {
constexpr float GRAVITY_MS2 = 9.80665f;
}

bool Imu::begin(TwoWire& wire, uint8_t address) {
  started_ = mpu_.begin(address, &wire);
  if (started_) {
    mpu_.setAccelerometerRange(MPU6050_RANGE_16_G);  // margen para picos de impacto
    mpu_.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu_.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }
  healthy_ = started_;
  return started_;
}

bool Imu::read() {
  if (!started_) return false;
  sensors_event_t a, g, t;
  healthy_ = mpu_.getEvent(&a, &g, &t);
  if (!healthy_) return false;
  float gx = a.acceleration.x / GRAVITY_MS2;
  float gy = a.acceleration.y / GRAVITY_MS2;
  float gz = a.acceleration.z / GRAVITY_MS2;
  magnitudeG_ = sqrtf(gx * gx + gy * gy + gz * gz);
  return true;
}

}  // namespace sensors
