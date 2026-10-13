// Tests native (sin placa) de lib/fall_detection: pnpm fw:test
// Trazas sintéticas de |a| muestreadas a 50 Hz, como las entrega el IMU en main.cpp.
#include <math.h>
#include <unity.h>

#include "fall_detector.h"

using fall_detection::FallDetector;
using fall_detection::FallParams;
using fall_detection::FallState;

static constexpr uint32_t STEP_MS = 20;  // 50 Hz
static uint32_t t = 0;
static int confirmations = 0;

/** Alimenta `g` durante `ms` (una muestra cada 20 ms). Devuelve true si alguna confirmó la caída. */
static bool feed(FallDetector& d, float g, uint32_t ms) {
  bool confirmed = false;
  for (uint32_t elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    if (d.update(g, t)) {
      confirmed = true;
      confirmations++;
    }
    t += STEP_MS;
  }
  return confirmed;
}

/** Caída típica: reposo, caída libre de 300 ms y un golpe de 3,6 g. */
static void fallUntilImpact(FallDetector& d) {
  feed(d, 1.0f, 500);
  feed(d, 0.2f, 300);
  feed(d, 3.6f, STEP_MS);
}

void setUp() {
  t = 1000;
  confirmations = 0;
}
void tearDown() {}

void test_impact_threshold_comes_from_contracts() {
  TEST_ASSERT_EQUAL_FLOAT(2.8f, vitalia::FALL_IMPACT_G);
  TEST_ASSERT_EQUAL_FLOAT(vitalia::FALL_IMPACT_G, FallParams{}.impactG);
}

void test_full_fall_is_confirmed_once() {
  FallDetector d;
  fallUntilImpact(d);
  TEST_ASSERT_TRUE(feed(d, 1.0f, 3000));  // settle 500 ms + inmovilidad 2000 ms
  TEST_ASSERT_EQUAL_INT(1, confirmations);
  TEST_ASSERT_TRUE(d.take());
  TEST_ASSERT_FALSE(d.take());  // el flag se consume en una sola lectura
  TEST_ASSERT_EQUAL(FallState::Idle, d.state());
}

void test_fall_is_not_confirmed_before_the_still_window() {
  FallDetector d;
  fallUntilImpact(d);
  TEST_ASSERT_FALSE(feed(d, 1.0f, 2400));  // le faltan ~100 ms
  TEST_ASSERT_EQUAL(FallState::CheckStill, d.state());
  TEST_ASSERT_FALSE(d.take());
}

void test_states_follow_the_three_phases() {
  FallDetector d;
  feed(d, 1.0f, 100);
  TEST_ASSERT_EQUAL(FallState::Idle, d.state());
  feed(d, 0.2f, 100);
  TEST_ASSERT_EQUAL(FallState::FreeFall, d.state());
  feed(d, 1.0f, STEP_MS);
  TEST_ASSERT_EQUAL(FallState::AwaitImpact, d.state());
  feed(d, 3.6f, STEP_MS);
  TEST_ASSERT_EQUAL(FallState::Settling, d.state());
  feed(d, 1.0f, 600);
  TEST_ASSERT_EQUAL(FallState::CheckStill, d.state());
  TEST_ASSERT_EQUAL_STRING("CHECK_STILL", fall_detection::stateName(d.state()));
}

void test_impact_without_free_fall_is_not_a_fall() {
  // Golpe de la mano contra la mesa: pico alto sin caída libre previa.
  FallDetector d;
  feed(d, 1.0f, 500);
  feed(d, 3.6f, STEP_MS);
  TEST_ASSERT_FALSE(feed(d, 1.0f, 3000));
  TEST_ASSERT_FALSE(d.take());
  TEST_ASSERT_TRUE(d.recentImpact(t, 5000));  // el impacto queda para diagnóstico
}

void test_impact_and_stillness_is_enough_without_free_fall_requirement() {
  FallParams p;
  p.requireFreeFall = false;
  FallDetector d(p);
  feed(d, 1.0f, 500);
  feed(d, 3.6f, STEP_MS);
  TEST_ASSERT_TRUE(feed(d, 1.0f, 3000));
}

void test_short_free_fall_is_ignored() {
  // Una sola muestra baja (40 ms en total) es vibración, no caída libre.
  FallDetector d;
  feed(d, 1.0f, 500);
  feed(d, 0.2f, 40);
  feed(d, 3.6f, STEP_MS);
  TEST_ASSERT_FALSE(feed(d, 1.0f, 3000));
}

void test_free_fall_without_impact_times_out() {
  FallDetector d;
  feed(d, 1.0f, 500);
  feed(d, 0.2f, 300);
  feed(d, 1.0f, 1200);  // más que la ventana de 1000 ms
  TEST_ASSERT_EQUAL(FallState::Idle, d.state());
  feed(d, 3.6f, STEP_MS);  // un golpe tardío ya no cuenta
  TEST_ASSERT_FALSE(feed(d, 1.0f, 3000));
}

void test_impact_equal_to_threshold_does_not_count() {
  FallDetector d;
  feed(d, 1.0f, 500);
  feed(d, 0.2f, 300);
  feed(d, 2.8f, STEP_MS);  // tiene que superarlo
  TEST_ASSERT_FALSE(feed(d, 1.0f, 3000));
}

void test_movement_after_impact_cancels_the_fall() {
  // El paciente se levanta después del golpe.
  FallDetector d;
  fallUntilImpact(d);
  feed(d, 1.0f, 800);
  feed(d, 1.6f, 40);
  TEST_ASSERT_FALSE(feed(d, 1.0f, 3000));
  TEST_ASSERT_FALSE(d.take());
}

void test_bounces_during_settling_are_ignored() {
  FallDetector d;
  fallUntilImpact(d);
  feed(d, 2.0f, 100);
  feed(d, 0.5f, 100);
  feed(d, 3.1f, STEP_MS);
  TEST_ASSERT_TRUE(feed(d, 1.0f, 3000));
}

void test_rest_offset_within_tolerance_still_confirms() {
  // El MPU6050 de la pulsera lee ~1,05 g en reposo (ESTADO.md, Hito 3).
  FallDetector d;
  fallUntilImpact(d);
  TEST_ASSERT_TRUE(feed(d, 1.05f, 3000));
}

void test_invalid_samples_are_ignored() {
  FallDetector d;
  fallUntilImpact(d);
  TEST_ASSERT_FALSE(feed(d, NAN, 3000));
  TEST_ASSERT_FALSE(feed(d, -1.0f, 100));
  TEST_ASSERT_FALSE(d.take());
}

void test_recent_fall_window_for_ui() {
  FallDetector d;
  TEST_ASSERT_FALSE(d.recentFall(t, 5000));
  fallUntilImpact(d);
  feed(d, 1.0f, 3000);
  uint32_t confirmedAt = t;
  TEST_ASSERT_TRUE(d.recentFall(confirmedAt, 5000));
  TEST_ASSERT_TRUE(d.recentFall(confirmedAt + 4000, 5000));
  TEST_ASSERT_FALSE(d.recentFall(confirmedAt + 6000, 5000));
}

void test_full_fall_across_millis_wraparound() {
  FallDetector d;
  t = 0xFFFFFFFFu - 1000;  // millis() da la vuelta en medio de la caída
  fallUntilImpact(d);
  TEST_ASSERT_TRUE(feed(d, 1.0f, 3000));
  TEST_ASSERT_TRUE(d.recentFall(t, 5000));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_impact_threshold_comes_from_contracts);
  RUN_TEST(test_full_fall_is_confirmed_once);
  RUN_TEST(test_fall_is_not_confirmed_before_the_still_window);
  RUN_TEST(test_states_follow_the_three_phases);
  RUN_TEST(test_impact_without_free_fall_is_not_a_fall);
  RUN_TEST(test_impact_and_stillness_is_enough_without_free_fall_requirement);
  RUN_TEST(test_short_free_fall_is_ignored);
  RUN_TEST(test_free_fall_without_impact_times_out);
  RUN_TEST(test_impact_equal_to_threshold_does_not_count);
  RUN_TEST(test_movement_after_impact_cancels_the_fall);
  RUN_TEST(test_bounces_during_settling_are_ignored);
  RUN_TEST(test_rest_offset_within_tolerance_still_confirms);
  RUN_TEST(test_invalid_samples_are_ignored);
  RUN_TEST(test_recent_fall_window_for_ui);
  RUN_TEST(test_full_fall_across_millis_wraparound);
  return UNITY_END();
}
