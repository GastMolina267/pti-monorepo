#pragma once
/**
 * AES-256-GCM sin AAD (ADR 0006) con mbedTLS, que en el ESP32-C3 usa el acelerador AES
 * por hardware. Clave de 32 bytes, IV de 12, tag de 16 (vitalia::CIPHER_*).
 *
 * Solo compila en la placa: los tests están en test/esp32/test_crypto y usan los vectores
 * compartidos con la API (test/fixtures/gcm_vectors.h).
 */
#include <stddef.h>
#include <stdint.h>

namespace crypto {

bool gcmEncrypt(const uint8_t* key, const uint8_t* iv, const uint8_t* plaintext, size_t len,
                uint8_t* ciphertext, uint8_t* tag);

/** Devuelve false si el tag no valida: el mensaje se descarta. */
bool gcmDecrypt(const uint8_t* key, const uint8_t* iv, const uint8_t* ciphertext, size_t len,
                const uint8_t* tag, uint8_t* plaintext);

/**
 * Cifra `plaintext` con un IV aleatorio nuevo (generador por hardware) y escribe el sobre
 * JSON del contrato en `out`. Devuelve los bytes escritos, o 0 si algo falla.
 * Nunca reutilizar un IV con la misma clave: por eso el IV se genera acá adentro.
 */
size_t seal(const uint8_t* key, const char* plaintext, size_t len, char* out, size_t outLen);

}  // namespace crypto
