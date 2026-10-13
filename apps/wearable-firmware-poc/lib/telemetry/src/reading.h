#pragma once
/**
 * TelemetryReading del contrato (@vitalia/contracts, docs/04-contratos.md) y su
 * serialización a JSON. Sin Arduino: compila y se testea en el entorno native.
 */
#include <stddef.h>
#include <stdint.h>

#include <optional>

namespace telemetry {

/** Largo de `wb-NN-xxxxxx` + NUL. */
constexpr size_t WEARABLE_ID_LEN = 13;

struct Reading {
  char wearableId[WEARABLE_ID_LEN] = {0};
  uint64_t seq = 0;
  /** Epoch en ms (hora NTP del wearable). */
  uint64_t tsMs = 0;
  std::optional<uint16_t> hr;      // BPM; vacío hasta el Hito 5 (MAX30102)
  std::optional<uint8_t> spo2;     // %
  std::optional<float> temp;       // °C, ya compensada a temperatura clínica
  std::optional<float> accPeakG;   // g, pico del intervalo
  bool fall = false;
};

/**
 * Escribe el JSON de la lectura en `out` (terminado en NUL), con las claves en el
 * orden del contrato y sin los campos opcionales vacíos. `temp` va con 1 decimal y
 * `accPeakG` con 2. Devuelve los bytes escritos, o 0 si `out` no alcanza.
 */
size_t serializeReading(const Reading& reading, char* out, size_t outLen);

/** `seq` = arranque << SEQ_BOOT_SHIFT | contador (composeSeq de contracts). */
uint64_t composeSeq(uint32_t boot, uint32_t counter);

/**
 * Arma `wb-<NN>-<mac>` (ADR 0011) con los últimos 3 bytes de la MAC.
 * Devuelve false si `number` está fuera de 1–99 o `out` no alcanza.
 */
bool formatWearableCode(char* out, size_t outLen, int number, const uint8_t mac[6]);

}  // namespace telemetry
