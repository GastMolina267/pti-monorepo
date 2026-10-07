#pragma once
/** LED onboard (GPIO 8, activo en BAJO): fijo = conectado, parpadeo = sin Wi-Fi. */
#include <Arduino.h>

namespace ui {

class StatusLed {
 public:
  explicit StatusLed(uint8_t pin) : pin_(pin) {}

  void begin() {
    pinMode(pin_, OUTPUT);
    off();
  }
  void on() { digitalWrite(pin_, LOW); }
  void off() { digitalWrite(pin_, HIGH); }
  void blink(uint32_t nowMs, uint32_t halfPeriodMs) {
    if ((nowMs / halfPeriodMs) % 2) off();
    else on();
  }

 private:
  uint8_t pin_;
};

}  // namespace ui
