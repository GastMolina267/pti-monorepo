#pragma once
/**
 * Sobre cifrado del contrato (EncryptedEnvelope, ADR 0006): { "v", "iv", "ct", "tag" } en base64.
 * Sin Arduino ni mbedTLS: solo el formato, así se testea en native. El cifrado está en lib/crypto.
 */
#include <stddef.h>
#include <stdint.h>

namespace envelope {

/** Base64 estándar (RFC 4648, con `=`). Devuelve los caracteres escritos sin el NUL, o 0 si no entra. */
size_t base64Encode(const uint8_t* in, size_t len, char* out, size_t outLen);

/** Largo de `base64Encode` para `len` bytes, sin el NUL. */
constexpr size_t base64Len(size_t len) { return ((len + 2) / 3) * 4; }

/**
 * Convierte exactamente `outLen` bytes desde `hex` (2 × outLen caracteres, mayúsculas o
 * minúsculas). Devuelve false si el largo no coincide o hay caracteres que no son hex.
 * Se usa para la clave `TELEMETRY_AES_KEY_HEX` de secrets.h.
 */
bool hexToBytes(const char* hex, uint8_t* out, size_t outLen);

/**
 * Arma el JSON del sobre con las claves en el orden del contrato. `iv` y `tag` miden
 * vitalia::CIPHER_IV_BYTES y vitalia::CIPHER_TAG_BYTES. Devuelve los bytes escritos o 0.
 */
size_t buildEnvelopeJson(const uint8_t* iv, const uint8_t* ct, size_t ctLen, const uint8_t* tag,
                         char* out, size_t outLen);

}  // namespace envelope
