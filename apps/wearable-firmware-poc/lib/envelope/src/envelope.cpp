#include "envelope.h"

#include <ArduinoJson.h>

#include "vitalia_contracts.h"

namespace envelope {

namespace {

constexpr char kAlphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

int hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

// El ct más largo que se publica: una TelemetryReading completa (~150 bytes) con margen.
constexpr size_t kMaxCtBytes = 256;

}  // namespace

size_t base64Encode(const uint8_t* in, size_t len, char* out, size_t outLen) {
  size_t needed = base64Len(len);
  if (needed + 1 > outLen) return 0;
  size_t o = 0;
  for (size_t i = 0; i < len; i += 3) {
    uint32_t chunk = static_cast<uint32_t>(in[i]) << 16;
    if (i + 1 < len) chunk |= static_cast<uint32_t>(in[i + 1]) << 8;
    if (i + 2 < len) chunk |= in[i + 2];
    out[o++] = kAlphabet[(chunk >> 18) & 0x3F];
    out[o++] = kAlphabet[(chunk >> 12) & 0x3F];
    out[o++] = i + 1 < len ? kAlphabet[(chunk >> 6) & 0x3F] : '=';
    out[o++] = i + 2 < len ? kAlphabet[chunk & 0x3F] : '=';
  }
  out[o] = '\0';
  return o;
}

bool hexToBytes(const char* hex, uint8_t* out, size_t outLen) {
  if (hex == nullptr) return false;
  for (size_t i = 0; i < outLen; ++i) {
    if (hex[2 * i] == '\0' || hex[2 * i + 1] == '\0') return false;
    int hi = hexValue(hex[2 * i]);
    int lo = hexValue(hex[2 * i + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = static_cast<uint8_t>((hi << 4) | lo);
  }
  return hex[2 * outLen] == '\0';
}

size_t buildEnvelopeJson(const uint8_t* iv, const uint8_t* ct, size_t ctLen, const uint8_t* tag,
                         char* out, size_t outLen) {
  if (ctLen > kMaxCtBytes) return 0;
  char ivB64[base64Len(vitalia::CIPHER_IV_BYTES) + 1];
  char ctB64[base64Len(kMaxCtBytes) + 1];
  char tagB64[base64Len(vitalia::CIPHER_TAG_BYTES) + 1];
  base64Encode(iv, vitalia::CIPHER_IV_BYTES, ivB64, sizeof(ivB64));
  base64Encode(ct, ctLen, ctB64, sizeof(ctB64));
  base64Encode(tag, vitalia::CIPHER_TAG_BYTES, tagB64, sizeof(tagB64));

  JsonDocument doc;
  doc["v"] = vitalia::ENVELOPE_VERSION;
  doc["iv"] = ivB64;
  doc["ct"] = ctB64;
  doc["tag"] = tagB64;
  if (measureJson(doc) >= outLen) return 0;
  return serializeJson(doc, out, outLen);
}

}  // namespace envelope
