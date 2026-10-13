// Tests native (sin placa) de lib/fall_detection: pnpm fw:test
#include <unity.h>

#include "impact_detector.h"

using fall_detection::ImpactDetector;

void setUp() {}
void tearDown() {}

void test_threshold_comes_from_contracts() {
  TEST_ASSERT_EQUAL_FLOAT(2.8f, vitalia::FALL_IMPACT_G);
}

void test_no_fall_below_threshold() {
  ImpactDetector d;
  d.update(1.0f, 0);
  d.update(2.8f, 20);  // igual al umbral: no alcanza (tiene que superarlo)
  TEST_ASSERT_FALSE(d.take());
}

void test_fall_above_threshold_latches_until_taken() {
  ImpactDetector d;
  d.update(3.5f, 100);
  d.update(1.0f, 120);  // vuelve a reposo: el flag sigue hasta la próxima lectura
  TEST_ASSERT_TRUE(d.take());
  TEST_ASSERT_FALSE(d.take());
}

void test_recent_impact_window_for_ui() {
  ImpactDetector d;
  TEST_ASSERT_FALSE(d.recentImpact(0, 5000));
  d.update(4.0f, 1000);
  TEST_ASSERT_TRUE(d.recentImpact(3000, 5000));
  TEST_ASSERT_TRUE(d.recentImpact(6000, 5000));
  TEST_ASSERT_FALSE(d.recentImpact(6001, 5000));
}

void test_recent_impact_survives_millis_wraparound() {
  ImpactDetector d;
  d.update(4.0f, 0xFFFFFF00u);
  TEST_ASSERT_TRUE(d.recentImpact(0x00000100u, 5000));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_threshold_comes_from_contracts);
  RUN_TEST(test_no_fall_below_threshold);
  RUN_TEST(test_fall_above_threshold_latches_until_taken);
  RUN_TEST(test_recent_impact_window_for_ui);
  RUN_TEST(test_recent_impact_survives_millis_wraparound);
  return UNITY_END();
}
