// Tests EN LA PLACA de lib/crypto con los vectores compartidos con la API:
//   pnpm nx run wearable-firmware-poc:pio-test-device   (placa conectada por USB)
// La CI solo los compila (no hay placa en el runner).
#include <Arduino.h>
#include <ArduinoJson.h>
#include <mbedtls/base64.h>
#include <string.h>
#include <unity.h>

#include "../../fixtures/gcm_vectors.h"
#include "gcm.h"

void setUp() {}
void tearDown() {}

void test_vectors_encrypt_to_expected_ct_and_tag() {
  for (size_t i = 0; i < GCM_TEST_VECTORS_COUNT; ++i) {
    const gcm_test_vector_t& v = GCM_TEST_VECTORS[i];
    if (!v.expect_ok) continue;
    uint8_t ct[256];
    uint8_t tag[16];
    TEST_ASSERT_TRUE_MESSAGE(crypto::gcmEncrypt(v.key, v.iv, v.plaintext, v.plaintext_len, ct, tag), v.name);
    TEST_ASSERT_EQUAL_MEMORY_MESSAGE(v.ct, ct, v.plaintext_len, v.name);
    TEST_ASSERT_EQUAL_MEMORY_MESSAGE(v.tag, tag, 16, v.name);
  }
}

void test_vectors_decrypt_or_reject() {
  for (size_t i = 0; i < GCM_TEST_VECTORS_COUNT; ++i) {
    const gcm_test_vector_t& v = GCM_TEST_VECTORS[i];
    uint8_t pt[256];
    bool ok = crypto::gcmDecrypt(v.key, v.iv, v.ct, v.plaintext_len, v.tag, pt);
    TEST_ASSERT_EQUAL_MESSAGE(v.expect_ok, ok, v.name);
    if (ok) TEST_ASSERT_EQUAL_MEMORY_MESSAGE(v.plaintext, pt, v.plaintext_len, v.name);
  }
}

static size_t b64decode(const char* in, uint8_t* out, size_t outLen) {
  size_t n = 0;
  if (mbedtls_base64_decode(out, outLen, &n, reinterpret_cast<const unsigned char*>(in), strlen(in)) != 0) return 0;
  return n;
}

// seal(): sobre con IV aleatorio que se descifra de vuelta a la lectura original.
void test_seal_roundtrip_with_random_iv() {
  const char* reading = reinterpret_cast<const char*>(vitalia_reading_plaintext);
  size_t len = sizeof(vitalia_reading_plaintext);
  char env1[512];
  char env2[512];
  TEST_ASSERT_GREATER_THAN(0, crypto::seal(vitalia_reading_key, reading, len, env1, sizeof(env1)));
  TEST_ASSERT_GREATER_THAN(0, crypto::seal(vitalia_reading_key, reading, len, env2, sizeof(env2)));
  TEST_ASSERT_TRUE_MESSAGE(strcmp(env1, env2) != 0, "dos sobres seguidos no pueden repetir IV");

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, env1));
  TEST_ASSERT_EQUAL(1, doc["v"].as<int>());
  uint8_t iv[16], ct[256], tag[16], pt[256];
  TEST_ASSERT_EQUAL(12, b64decode(doc["iv"], iv, sizeof(iv)));
  TEST_ASSERT_EQUAL(len, b64decode(doc["ct"], ct, sizeof(ct)));
  TEST_ASSERT_EQUAL(16, b64decode(doc["tag"], tag, sizeof(tag)));
  TEST_ASSERT_TRUE(crypto::gcmDecrypt(vitalia_reading_key, iv, ct, len, tag, pt));
  TEST_ASSERT_EQUAL_MEMORY(vitalia_reading_plaintext, pt, len);
}

void setup() {
  delay(2000);  // USB CDC: dar tiempo a que el monitor de pio test se conecte
  UNITY_BEGIN();
  RUN_TEST(test_vectors_encrypt_to_expected_ct_and_tag);
  RUN_TEST(test_vectors_decrypt_or_reject);
  RUN_TEST(test_seal_roundtrip_with_random_iv);
  UNITY_END();
}

void loop() {}
