// GENERADO con `pnpm fw:codegen` desde
// libs/shared/contracts/src/lib/{telemetry,clinical} — NO EDITAR A MANO.
// Constantes del contrato que el firmware tiene que respetar (docs/04-contratos.md).
#pragma once

#include <stdint.h>

namespace vitalia {

// --- MQTT ---
constexpr const char* MQTT_TOPIC_ROOT = "hospital";
constexpr uint8_t MQTT_QOS = 1;
// snprintf(buf, len, FMT, sala, wearableId)
constexpr const char* MQTT_TOPIC_DATA_FMT = "hospital/%s/wearable/%s/data";
constexpr const char* MQTT_TOPIC_CMD_FMT = "hospital/%s/wearable/%s/cmd";

// --- Sobre cifrado (ADR 0006) ---
constexpr uint8_t ENVELOPE_VERSION = 1;
constexpr uint8_t CIPHER_KEY_BYTES = 32;
constexpr uint8_t CIPHER_IV_BYTES = 12;
constexpr uint8_t CIPHER_TAG_BYTES = 16;

// --- seq = arranque << SEQ_BOOT_SHIFT | contador ---
constexpr uint8_t SEQ_BOOT_SHIFT = 24;

// --- Identificador wb-<NN>-<mac> (ADR 0011) ---
constexpr int WEARABLE_NUMBER_MIN = 1;
constexpr int WEARABLE_NUMBER_MAX = 99;

// --- Umbrales clínicos (CLINICAL_THRESHOLDS) ---
constexpr float HEART_RATE_NORMAL_MIN = 60.0f;
constexpr float HEART_RATE_NORMAL_MAX = 100.0f;
constexpr float HEART_RATE_CRITICAL_MIN = 40.0f;
constexpr float HEART_RATE_CRITICAL_MAX = 130.0f;
constexpr float SPO2_NORMAL_MIN = 95.0f;
constexpr float SPO2_CRITICAL_BELOW = 90.0f;
constexpr float TEMPERATURE_FEVER_ABOVE = 37.5f;
constexpr float TEMPERATURE_CRITICAL_ABOVE = 39.5f;
constexpr float TEMPERATURE_HYPOTHERMIA_BELOW = 35.0f;
constexpr float FALL_IMPACT_G = 2.8f;

}  // namespace vitalia
