#include "pulse_ox.h"

namespace sensors {

bool PulseOx::begin(TwoWire& wire, const PulseOxConfig& config) {
  fingerIrMin_ = config.fingerIrMin;
  // La librería llama a wire.begin() sin pines: con el bus ya iniciado el core solo avisa
  // ("Bus already started") y conserva GPIO5/6. El reloj es el mismo (100 kHz, AGENTS.md §2.3).
  started_ = sensor_.begin(wire, I2C_SPEED_STANDARD);
  healthy_ = false;  // recién es sano con la primera muestra leída
  if (!started_) return false;
  // ledMode 2 = rojo + IR (SpO2). El LED verde no existe en el MAX30102.
  sensor_.setup(config.ledAmplitude, config.sampleAverage, 2, config.sampleRate, config.pulseWidthUs,
                config.adcRange);
  return true;
}

}  // namespace sensors
