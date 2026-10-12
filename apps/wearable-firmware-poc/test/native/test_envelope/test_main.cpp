// Tests native (sin placa) de lib/envelope: pnpm fw:test
#include <string.h>
#include <unity.h>

#include "../../fixtures/gcm_vectors.h"
#include "envelope.h"

void setUp() {}
void tearDown() {}

static const char* b64(const char* text) {
  static char out[64];
  envelope::base64Encode(reinterpret_cast<const uint8_t*>(text), strlen(text), out, sizeof(out));
  return out;
}

// Vectores de la RFC 4648 §10.
void test_base64_rfc4648_vectors() {
  TEST_ASSERT_EQUAL_STRING("", b64(""));
  TEST_ASSERT_EQUAL_STRING("Zg==", b64("f"));
  TEST_ASSERT_EQUAL_STRING("Zm8=", b64("fo"));
  TEST_ASSERT_EQUAL_STRING("Zm9v", b64("foo"));
  TEST_ASSERT_EQUAL_STRING("Zm9vYg==", b64("foob"));
  TEST_ASSERT_EQUAL_STRING("Zm9vYmE=", b64("fooba"));
  TEST_ASSERT_EQUAL_STRING("Zm9vYmFy", b64("foobar"));
}

void test_base64_returns_zero_when_buffer_is_small() {
  const uint8_t data[3] = {1, 2, 3};
  char out[4];  // necesita 4 + NUL
  TEST_ASSERT_EQUAL_size_t(0, envelope::base64Encode(data, 3, out, sizeof(out)));
}

void test_hex_to_bytes_parses_the_test_key() {
  uint8_t key[32];
  TEST_ASSERT_TRUE(envelope::hexToBytes(
      "000102030405060708090a0b0c0d0e0f101112131415161718191A1B1C1D1E1F", key, sizeof(key)));
  TEST_ASSERT_EQUAL_MEMORY(vitalia_reading_key, key, sizeof(key));
}

void test_hex_to_bytes_rejects_bad_input() {
  uint8_t key[4];
  TEST_ASSERT_FALSE(envelope::hexToBytes("", key, sizeof(key)));            // vacía (secrets.h sin completar)
  TEST_ASSERT_FALSE(envelope::hexToBytes("0011223", key, sizeof(key)));     // corta
  TEST_ASSERT_FALSE(envelope::hexToBytes("0011223344", key, sizeof(key)));  // larga
  TEST_ASSERT_FALSE(envelope::hexToBytes("00112g33", key, sizeof(key)));    // no hex
  TEST_ASSERT_FALSE(envelope::hexToBytes(nullptr, key, sizeof(key)));
}

// El sobre que arma el firmware tiene que ser idéntico al del vector de contracts.
void test_envelope_matches_shared_vector() {
  char out[512];
  size_t n = envelope::buildEnvelopeJson(vitalia_reading_iv, vitalia_reading_ct, sizeof(vitalia_reading_ct),
                                         vitalia_reading_tag, out, sizeof(out));
  TEST_ASSERT_EQUAL_size_t(strlen(vitalia_reading_envelope_json), n);
  TEST_ASSERT_EQUAL_STRING(vitalia_reading_envelope_json, out);
}

void test_envelope_returns_zero_when_buffer_is_small() {
  char out[32];
  TEST_ASSERT_EQUAL_size_t(0, envelope::buildEnvelopeJson(vitalia_reading_iv, vitalia_reading_ct,
                                                           sizeof(vitalia_reading_ct), vitalia_reading_tag,
                                                           out, sizeof(out)));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_base64_rfc4648_vectors);
  RUN_TEST(test_base64_returns_zero_when_buffer_is_small);
  RUN_TEST(test_hex_to_bytes_parses_the_test_key);
  RUN_TEST(test_hex_to_bytes_rejects_bad_input);
  RUN_TEST(test_envelope_matches_shared_vector);
  RUN_TEST(test_envelope_returns_zero_when_buffer_is_small);
  return UNITY_END();
}
