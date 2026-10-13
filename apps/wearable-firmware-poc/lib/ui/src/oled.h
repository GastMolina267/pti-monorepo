#pragma once
/** OLED SSD1306 128×32: tres líneas de texto. */
#include <Adafruit_SSD1306.h>
#include <Wire.h>

namespace ui {

class Oled {
 public:
  /**
   * El reloj I²C se fija en las DOS fases (durante y después de display()). Si no,
   * la librería sube el bus a 400 kHz y corrompe la transferencia con el MLX90614
   * en el mismo bus (AGENTS.md §3).
   */
  Oled(TwoWire& wire, uint32_t clockHz);
  bool begin(uint8_t address);
  bool isHealthy() const { return healthy_; }
  void show(const char* line0, const char* line1, const char* line2);

 private:
  Adafruit_SSD1306 display_;
  bool healthy_ = false;
};

}  // namespace ui
