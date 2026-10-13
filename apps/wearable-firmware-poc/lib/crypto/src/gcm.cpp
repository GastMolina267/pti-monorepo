#include "gcm.h"

#include <esp_random.h>
#include <mbedtls/gcm.h>

#include "envelope.h"
#include "vitalia_contracts.h"

namespace crypto {

namespace {

// Lo más largo que se cifra: una TelemetryReading completa, con margen.
constexpr size_t kMaxPlaintext = 256;

class GcmContext {
 public:
  explicit GcmContext(const uint8_t* key) {
    mbedtls_gcm_init(&ctx_);
    ok_ = mbedtls_gcm_setkey(&ctx_, MBEDTLS_CIPHER_ID_AES, key, vitalia::CIPHER_KEY_BYTES * 8) == 0;
  }
  ~GcmContext() { mbedtls_gcm_free(&ctx_); }
  bool ok() const { return ok_; }
  mbedtls_gcm_context* get() { return &ctx_; }

 private:
  mbedtls_gcm_context ctx_;
  bool ok_;
};

}  // namespace

bool gcmEncrypt(const uint8_t* key, const uint8_t* iv, const uint8_t* plaintext, size_t len,
                uint8_t* ciphertext, uint8_t* tag) {
  GcmContext gcm(key);
  if (!gcm.ok()) return false;
  return mbedtls_gcm_crypt_and_tag(gcm.get(), MBEDTLS_GCM_ENCRYPT, len, iv, vitalia::CIPHER_IV_BYTES,
                                   nullptr, 0, plaintext, ciphertext, vitalia::CIPHER_TAG_BYTES,
                                   tag) == 0;
}

bool gcmDecrypt(const uint8_t* key, const uint8_t* iv, const uint8_t* ciphertext, size_t len,
                const uint8_t* tag, uint8_t* plaintext) {
  GcmContext gcm(key);
  if (!gcm.ok()) return false;
  return mbedtls_gcm_auth_decrypt(gcm.get(), len, iv, vitalia::CIPHER_IV_BYTES, nullptr, 0, tag,
                                  vitalia::CIPHER_TAG_BYTES, ciphertext, plaintext) == 0;
}

size_t seal(const uint8_t* key, const char* plaintext, size_t len, char* out, size_t outLen) {
  if (len > kMaxPlaintext) return 0;
  uint8_t iv[vitalia::CIPHER_IV_BYTES];
  uint8_t ct[kMaxPlaintext];
  uint8_t tag[vitalia::CIPHER_TAG_BYTES];
  esp_fill_random(iv, sizeof(iv));
  if (!gcmEncrypt(key, iv, reinterpret_cast<const uint8_t*>(plaintext), len, ct, tag)) return 0;
  return envelope::buildEnvelopeJson(iv, ct, len, tag, out, outLen);
}

}  // namespace crypto
