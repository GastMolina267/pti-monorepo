// Tests native (sin placa) de lib/ppg: pnpm fw:test
// Señales PPG SINTÉTICAS a 25 muestras/s, como las entrega el MAX30102 en main.cpp. No se usan
// capturas reales: son datos biométricos (Ley 25.326).
#include <math.h>
#include <unity.h>

#include "pulse_ox_estimator.h"
#include "sample_watchdog.h"

using ppg::PulseOxEstimator;

static constexpr float FS = 25.0f;
static constexpr float IR_DC = 110000.0f;
static constexpr float RED_DC = 98000.0f;

struct Synth {
  float bpm = 75.0f;
  float ratio = 0.5f;      // (AC/DC)rojo / (AC/DC)IR
  float pulseFrac = 0.007f;  // amplitud del pulso / DC (≈ 0,5 % de perfusión RMS)
  float noiseFrac = 0.0f;  // ruido uniforme / DC
  float phase = 0.0f;
  uint32_t seed = 12345;

  float noise() {  // LCG: determinístico, mismo resultado en cada corrida
    seed = seed * 1664525u + 1013904223u;
    return (static_cast<float>(seed >> 8) / 8388608.0f) - 1.0f;
  }
  /** Pulso con un segundo armónico (muesca dicrótica): no tiene que contar como otro latido. */
  float shape() const { return sinf(2 * M_PI * phase) + 0.3f * sinf(4 * M_PI * phase - 0.5f); }

  void sample(uint32_t& ir, uint32_t& red, float extraFrac = 0.0f) {
    float p = shape();
    float n = noiseFrac * noise();
    ir = static_cast<uint32_t>(IR_DC * (1.0f - pulseFrac * p + n + extraFrac));
    red = static_cast<uint32_t>(RED_DC * (1.0f - ratio * pulseFrac * p + n + extraFrac));
    phase += bpm / 60.0f / FS;
    if (phase >= 1.0f) phase -= 1.0f;
  }
};

static void feed(PulseOxEstimator& e, Synth& s, float seconds) {
  for (int i = 0; i < static_cast<int>(seconds * FS); i++) {
    uint32_t ir, red;
    s.sample(ir, red);
    e.push(ir, red);
  }
}

void setUp() {}
void tearDown() {}

void test_no_finger_gives_nothing() {
  PulseOxEstimator e;
  for (int i = 0; i < 500; i++) e.push(600, 550);
  TEST_ASSERT_FALSE(e.fingerPresent());
  TEST_ASSERT_FALSE(e.hr().has_value());
  TEST_ASSERT_FALSE(e.spo2().has_value());
}

void test_needs_warmup_and_beats_before_a_value() {
  PulseOxEstimator e;
  Synth s;
  feed(e, s, 3.0f);  // 2 s de calentamiento + ~1 s: todavía no hay 5 intervalos
  TEST_ASSERT_TRUE(e.fingerPresent());
  TEST_ASSERT_FALSE(e.hr().has_value());
  feed(e, s, 10.0f);
  TEST_ASSERT_TRUE(e.hr().has_value());
}

static void assertBpm(float bpm) {
  PulseOxEstimator e;
  Synth s;
  s.bpm = bpm;
  feed(e, s, 20.0f);
  TEST_ASSERT_TRUE_MESSAGE(e.hr().has_value(), "sin BPM");
  TEST_ASSERT_INT_WITHIN(3, static_cast<int>(lroundf(bpm)), *e.hr());
}

void test_heart_rate_60() { assertBpm(60.0f); }
void test_heart_rate_87() { assertBpm(87.0f); }
void test_heart_rate_120() { assertBpm(120.0f); }

void test_spo2_follows_the_ratio() {
  for (float r : {0.45f, 0.6f, 0.8f}) {
    PulseOxEstimator e;
    Synth s;
    s.ratio = r;
    feed(e, s, 20.0f);
    TEST_ASSERT_TRUE(e.spo2().has_value());
    TEST_ASSERT_INT_WITHIN(1, static_cast<int>(lroundf(ppg::spo2FromRatio(r))), *e.spo2());
  }
}

void test_spo2_curve() {
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 99.5f, ppg::spo2FromRatio(0.44f));  // ≈ lo medido en la placa
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 90.3f, ppg::spo2FromRatio(0.8f));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, ppg::spo2FromRatio(3.0f));  // la curva da negativo: recortada a 0
  TEST_ASSERT_TRUE(ppg::spo2FromRatio(0.34f) <= 100.0f);   // el máximo de la curva (~99,96 %)
}

void test_finger_removed_resets() {
  PulseOxEstimator e;
  Synth s;
  feed(e, s, 15.0f);
  TEST_ASSERT_TRUE(e.hr().has_value());
  e.push(600, 550);
  TEST_ASSERT_FALSE(e.fingerPresent());
  TEST_ASSERT_FALSE(e.hr().has_value());
  TEST_ASSERT_FALSE(e.spo2().has_value());
}

// Movimiento: oscilaciones grandes (8 % de la DC) que no son pulso → nada; quieto otra vez → vuelve.
void test_motion_clears_and_recovers() {
  PulseOxEstimator e;
  Synth s;
  feed(e, s, 15.0f);
  TEST_ASSERT_TRUE(e.hr().has_value());
  for (int i = 0; i < static_cast<int>(5 * FS); i++) {
    uint32_t ir, red;
    s.sample(ir, red, 0.08f * sinf(2 * M_PI * 1.7f * i / FS) + 0.03f * s.noise());
    e.push(ir, red);
  }
  TEST_ASSERT_FALSE(e.hr().has_value());
  TEST_ASSERT_FALSE(e.spo2().has_value());
  TEST_ASSERT_TRUE(e.perfusion() > 0.02f);
  feed(e, s, 15.0f);
  TEST_ASSERT_TRUE(e.hr().has_value());
  TEST_ASSERT_INT_WITHIN(3, 75, *e.hr());
}

void test_light_noise_is_tolerated() {
  PulseOxEstimator e;
  Synth s;
  s.bpm = 87.0f;
  s.noiseFrac = 0.0005f;  // 0,05 % de la DC, un décimo del pulso
  feed(e, s, 20.0f);
  TEST_ASSERT_TRUE(e.hr().has_value());
  TEST_ASSERT_INT_WITHIN(3, 87, *e.hr());
}

void test_weak_signal_gives_nothing() {
  PulseOxEstimator e;
  Synth s;
  s.pulseFrac = 0.0005f;  // perfusión ≈ 0,04 %: dedo apoyado pero sin pulso medible
  feed(e, s, 20.0f);
  TEST_ASSERT_FALSE(e.hr().has_value());
}

void test_bad_red_channel_gives_hr_without_spo2() {
  // Rojo en 0 (LED o lectura defectuosa) o sin pulso: R no es finito/positivo. El BPM sale
  // del IR y sigue valiendo; el SpO2 se omite en vez de convertir un NaN.
  for (bool zero : {true, false}) {
    PulseOxEstimator e;
    Synth s;
    for (int i = 0; i < static_cast<int>(20.0f * FS); i++) {
      uint32_t ir, red;
      s.sample(ir, red);
      e.push(ir, zero ? 0u : static_cast<uint32_t>(RED_DC));
    }
    TEST_ASSERT_TRUE(e.hr().has_value());
    TEST_ASSERT_INT_WITHIN(3, 75, *e.hr());
    TEST_ASSERT_FALSE(e.spo2().has_value());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, e.ratio());
  }
}

void test_sample_watchdog() {
  ppg::SampleWatchdog w(2000);
  TEST_ASSERT_TRUE(w.stale(0));  // nunca llegaron muestras
  w.feed(1000);
  TEST_ASSERT_FALSE(w.stale(3000));
  TEST_ASSERT_TRUE(w.stale(3001));
  w.feed(UINT32_MAX - 500);  // desborde de millis()
  TEST_ASSERT_FALSE(w.stale(1000));
  TEST_ASSERT_TRUE(w.stale(1600));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_no_finger_gives_nothing);
  RUN_TEST(test_needs_warmup_and_beats_before_a_value);
  RUN_TEST(test_heart_rate_60);
  RUN_TEST(test_heart_rate_87);
  RUN_TEST(test_heart_rate_120);
  RUN_TEST(test_spo2_follows_the_ratio);
  RUN_TEST(test_spo2_curve);
  RUN_TEST(test_finger_removed_resets);
  RUN_TEST(test_motion_clears_and_recovers);
  RUN_TEST(test_light_noise_is_tolerated);
  RUN_TEST(test_weak_signal_gives_nothing);
  RUN_TEST(test_bad_red_channel_gives_hr_without_spo2);
  RUN_TEST(test_sample_watchdog);
  return UNITY_END();
}
