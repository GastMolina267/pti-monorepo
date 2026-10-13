#include "oled.h"

namespace ui {

namespace {
constexpr uint8_t kWidth = 128;
constexpr uint8_t kHeight = 32;
constexpr int8_t kResetPin = -1;
}  // namespace

Oled::Oled(TwoWire& wire, uint32_t clockHz)
    : display_(kWidth, kHeight, &wire, kResetPin, clockHz, clockHz) {}

bool Oled::begin(uint8_t address) {
  healthy_ = display_.begin(SSD1306_SWITCHCAPVCC, address);
  return healthy_;
}

void Oled::show(const char* line0, const char* line1, const char* line2) {
  if (!healthy_) return;
  display_.clearDisplay();
  display_.setTextColor(SSD1306_WHITE);
  display_.setTextSize(1);
  display_.setCursor(0, 0);
  display_.print(line0);
  display_.setCursor(0, 11);
  display_.print(line1);
  display_.setCursor(0, 22);
  display_.print(line2);
  display_.display();
}

}  // namespace ui
