// Tests native (sin placa) de lib/telemetry: pnpm fw:test
#include <string.h>
#include <unity.h>

#include "../../fixtures/gcm_vectors.h"
#include "peak_tracker.h"
#include "reading.h"

using telemetry::Reading;

static Reading exampleReading() {
  Reading r;
  strcpy(r.wearableId, "wb-01-24d7cc");
  r.seq = 1;
  r.tsMs = 1791065563577ULL;
  r.hr = 78;
  r.spo2 = 98;
  r.temp = 36.6f;
  r.accPeakG = 1.02f;
  r.fall = false;
  return r;
}

void setUp() {}
void tearDown() {}

// El JSON tiene que ser byte a byte el plaintext del vector GCM compartido con la API.
void test_serialize_matches_shared_gcm_vector_plaintext() {
  char out[256];
  size_t n = telemetry::serializeReading(exampleReading(), out, sizeof(out));
  TEST_ASSERT_EQUAL_size_t(sizeof(vitalia_reading_plaintext), n);
  TEST_ASSERT_EQUAL_MEMORY(vitalia_reading_plaintext, out, n);
}

void test_serialize_omits_empty_optionals() {
  Reading r = exampleReading();
  r.hr.reset();
  r.spo2.reset();
  r.temp.reset();
  r.accPeakG.reset();
  r.fall = true;
  char out[128];
  telemetry::serializeReading(r, out, sizeof(out));
  TEST_ASSERT_EQUAL_STRING("{\"wearableId\":\"wb-01-24d7cc\",\"seq\":1,\"ts\":1791065563577,\"fall\":true}", out);
}

void test_serialize_rounds_decimals() {
  Reading r = exampleReading();
  r.temp = 37.06f;
  r.accPeakG = 2.8149f;
  char out[256];
  telemetry::serializeReading(r, out, sizeof(out));
  TEST_ASSERT_NOT_NULL(strstr(out, "\"temp\":37.1,"));
  TEST_ASSERT_NOT_NULL(strstr(out, "\"accPeakG\":2.81,"));
}

void test_serialize_returns_zero_when_buffer_is_small() {
  char out[16];
  TEST_ASSERT_EQUAL_size_t(0, telemetry::serializeReading(exampleReading(), out, sizeof(out)));
}

// Mismos valores que seq.spec.ts de contracts.
void test_compose_seq_matches_contracts() {
  TEST_ASSERT_TRUE(telemetry::composeSeq(0, 0) == 0ULL);
  TEST_ASSERT_TRUE(telemetry::composeSeq(3, 7) == 3ULL * 16777216ULL + 7ULL);
  TEST_ASSERT_TRUE(telemetry::composeSeq(200, 1) == 200ULL * 16777216ULL + 1ULL);
}

void test_seq_keeps_growing_after_reboot() {
  TEST_ASSERT_TRUE(telemetry::composeSeq(5, 0) > telemetry::composeSeq(4, 16777215));
}

void test_format_wearable_code() {
  const uint8_t mac[6] = {0x44, 0xBD, 0x8D, 0x24, 0xD7, 0xCC};
  char out[telemetry::WEARABLE_ID_LEN];
  TEST_ASSERT_TRUE(telemetry::formatWearableCode(out, sizeof(out), 1, mac));
  TEST_ASSERT_EQUAL_STRING("wb-01-24d7cc", out);
  TEST_ASSERT_TRUE(telemetry::formatWearableCode(out, sizeof(out), 99, mac));
  TEST_ASSERT_EQUAL_STRING("wb-99-24d7cc", out);
}

void test_format_wearable_code_rejects_out_of_range() {
  const uint8_t mac[6] = {0};
  char out[telemetry::WEARABLE_ID_LEN];
  TEST_ASSERT_FALSE(telemetry::formatWearableCode(out, sizeof(out), 0, mac));
  TEST_ASSERT_FALSE(telemetry::formatWearableCode(out, sizeof(out), 100, mac));
}

void test_peak_tracker_takes_max_and_resets() {
  telemetry::PeakTracker peak;
  TEST_ASSERT_FALSE(peak.take().has_value());
  peak.update(1.0f);
  peak.update(3.2f);
  peak.update(0.9f);
  auto first = peak.take();
  TEST_ASSERT_TRUE(first.has_value());
  TEST_ASSERT_EQUAL_FLOAT(3.2f, *first);
  peak.update(0.5f);
  TEST_ASSERT_EQUAL_FLOAT(0.5f, *peak.take());
  TEST_ASSERT_FALSE(peak.take().has_value());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_serialize_matches_shared_gcm_vector_plaintext);
  RUN_TEST(test_serialize_omits_empty_optionals);
  RUN_TEST(test_serialize_rounds_decimals);
  RUN_TEST(test_serialize_returns_zero_when_buffer_is_small);
  RUN_TEST(test_compose_seq_matches_contracts);
  RUN_TEST(test_seq_keeps_growing_after_reboot);
  RUN_TEST(test_format_wearable_code);
  RUN_TEST(test_format_wearable_code_rejects_out_of_range);
  RUN_TEST(test_peak_tracker_takes_max_and_resets);
  return UNITY_END();
}
