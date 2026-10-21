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
constexpr const char* CMD_SHOW_TICKET = "SHOW_TICKET";
constexpr uint16_t COMMAND_PAYLOAD_BYTES = 512;
constexpr uint16_t COMMAND_TICKET_CODE_BYTES = 16;
constexpr uint16_t COMMAND_CONSULTING_ROOM_BYTES = 320;

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

// --- Rangos físicos de la lectura (TELEMETRY_READING_LIMITS): fuera, la API la descarta ---
constexpr float READING_HR_MIN = 20.0f;
constexpr float READING_HR_MAX = 250.0f;
constexpr float READING_SPO2_MIN = 50.0f;
constexpr float READING_SPO2_MAX = 100.0f;
constexpr float READING_TEMP_MIN = 25.0f;
constexpr float READING_TEMP_MAX = 45.0f;
constexpr float READING_ACC_PEAK_G_MIN = 0.0f;
constexpr float READING_ACC_PEAK_G_MAX = 16.0f;

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
