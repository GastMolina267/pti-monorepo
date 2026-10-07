#pragma once
/**
 * Constantes del firmware (pines, direcciones, tiempos). Sin secretos: eso va en secrets.h.
 * Lo que comparte con la plataforma (tópicos, umbrales clínicos, cifrado) viene de
 * include/vitalia_contracts.h, generado desde @vitalia/contracts: no se duplica acá.
 */
#include <stdint.h>

// --- Pines (AGENTS.md §2) ---
constexpr uint8_t PIN_LED = 8;  // onboard, activo en BAJO
constexpr uint8_t PIN_I2C_SDA = 5;
constexpr uint8_t PIN_I2C_SCL = 6;

// --- Bus I²C: 100 kHz siempre (el MLX90614 es SMBus, AGENTS.md §2.3) ---
constexpr uint32_t I2C_CLOCK_HZ = 100000;
constexpr uint8_t MPU6050_I2C_ADDR = 0x68;
constexpr uint8_t MLX90614_I2C_ADDR = 0x5A;
constexpr uint8_t OLED_I2C_ADDR = 0x3C;

// --- Temperatura (AGENTS.md §7) ---
constexpr float SKIN_TO_CORE_OFFSET_C = 1.2f;  // PROVISIONAL hasta tener la carcasa
// Solo para el OLED: la medición es gruesa. La clasificación oficial la hace la API con
// assessVitals() y TEMPERATURE_FEVER_ABOVE (37,5 °C).
constexpr float FEVER_DISPLAY_THRESHOLD_C = 38.0f;

// --- Tiempos (ms) ---
constexpr uint32_t IMU_PERIOD_MS = 20;          // 50 Hz
constexpr uint32_t TEMP_PERIOD_MS = 500;        // 2 Hz
constexpr uint32_t OLED_PERIOD_MS = 500;
constexpr uint32_t TELEMETRY_PERIOD_MS = 3000;  // una lectura cada 3 s (docs/03-dominio)
constexpr uint32_t WIFI_RETRY_MS = 3000;
constexpr uint32_t FALL_DISPLAY_MS = 5000;      // cuánto muestra la UI una caída

// --- Red ---
constexpr const char* MDNS_HOST = "wearable-pti";
