#include "pulse_ox_estimator.h"

#include <math.h>

namespace ppg {

namespace {

constexpr float kRmsAlpha = 0.02f;  // media exponencial de AC²: ~2 s a 25 muestras/s

float median(float* v, uint8_t n) {
  for (uint8_t i = 1; i < n; i++) {  // inserción: n ≤ 8
    float x = v[i];
    int8_t j = static_cast<int8_t>(i) - 1;
    while (j >= 0 && v[j] > x) {
      v[j + 1] = v[j];
      j--;
    }
    v[j + 1] = x;
  }
  return n % 2 ? v[n / 2] : 0.5f * (v[n / 2 - 1] + v[n / 2]);
}

}  // namespace

float spo2FromRatio(float r) {
  float s = -45.060f * r * r + 30.354f * r + 94.845f;
  return s < 0.0f ? 0.0f : (s > 100.0f ? 100.0f : s);
}

void PulseOxEstimator::reset() {
  window_ = p_.sampleRateHz < 4 ? 4 : (p_.sampleRateHz > kMaxWindow ? kMaxWindow : p_.sampleRateHz);
  irSum_ = redSum_ = 0;
  head_ = filled_ = 0;
  for (uint8_t i = 0; i < kSmooth; i++) irSmooth_[i] = redSmooth_[i] = 0.0f;
  smoothHead_ = 0;
  irMs_ = redMs_ = irDc_ = redDc_ = 0.0f;
  prev1_ = prev2_ = 0.0f;
  n_ = 0;
  clearBeats();
  finger_ = false;
  perfusion_ = 0.0f;
  ratio_ = 0.0f;
  hr_.reset();
  spo2_.reset();
  lastValidSample_ = 0;
}

void PulseOxEstimator::clearBeats() {
  hasLastBeat_ = false;
  intervalCount_ = 0;
  intervalHead_ = 0;
}

void PulseOxEstimator::push(uint32_t ir, uint32_t red) {
  if (ir < p_.fingerIrMin) {
    if (finger_ || filled_ > 0) reset();
    return;
  }
  finger_ = true;
  n_++;

  // --- DC: media móvil de 1 s, comparada contra la muestra del centro de la ventana ---
  if (filled_ == window_) {
    irSum_ -= irBuf_[head_];
    redSum_ -= redBuf_[head_];
  }
  irBuf_[head_] = ir;
  redBuf_[head_] = red;
  irSum_ += ir;
  redSum_ += red;
  head_ = static_cast<uint8_t>((head_ + 1) % window_);
  if (filled_ < window_) {
    filled_++;
    return;
  }
  const uint8_t center = static_cast<uint8_t>((head_ + window_ / 2) % window_);  // head_ = la más vieja
  irDc_ = static_cast<float>(irSum_) / window_;
  redDc_ = static_cast<float>(redSum_) / window_;

  // --- AC suavizado ---
  irSmooth_[smoothHead_] = static_cast<float>(irBuf_[center]) - irDc_;
  redSmooth_[smoothHead_] = static_cast<float>(redBuf_[center]) - redDc_;
  smoothHead_ = static_cast<uint8_t>((smoothHead_ + 1) % kSmooth);
  float irAc = 0.0f, redAc = 0.0f;
  for (uint8_t i = 0; i < kSmooth; i++) {
    irAc += irSmooth_[i];
    redAc += redSmooth_[i];
  }
  irAc /= kSmooth;
  redAc /= kSmooth;
  irMs_ += kRmsAlpha * (irAc * irAc - irMs_);
  redMs_ += kRmsAlpha * (redAc * redAc - redMs_);

  const float pulse = -irAc;  // en sístole llega menos luz: el pulso es el AC invertido
  if (n_ < msToSamples(p_.warmupMs)) {
    prev2_ = prev1_;
    prev1_ = pulse;
    return;
  }

  // --- Calidad: perfusión ---
  const float irRms = sqrtf(irMs_);
  perfusion_ = irDc_ > 0.0f ? irRms / irDc_ : 0.0f;
  if (perfusion_ < p_.perfusionMin || perfusion_ > p_.perfusionMax) {
    clearBeats();
    hr_.reset();
    spo2_.reset();
    prev2_ = prev1_;
    prev1_ = pulse;
    return;
  }

  // --- Latido: máximo local en la muestra anterior, con posición interpolada ---
  if (prev1_ > prev2_ && prev1_ >= pulse && prev1_ > p_.beatThreshold * irRms) {
    const float denom = prev2_ - 2.0f * prev1_ + pulse;
    const float offset = denom != 0.0f ? 0.5f * (prev2_ - pulse) / denom : 0.0f;
    const float beat = static_cast<float>(n_ - 1) + offset;
    if (!hasLastBeat_) {
      hasLastBeat_ = true;
      lastBeat_ = beat;
    } else {
      const float gap = beat - lastBeat_;
      if (gap >= static_cast<float>(msToSamples(p_.minBeatMs))) {
        if (gap <= static_cast<float>(msToSamples(p_.maxBeatMs))) {
          intervals_[intervalHead_] = gap;
          intervalHead_ = static_cast<uint8_t>((intervalHead_ + 1) % kMaxIntervals);
          if (intervalCount_ < kMaxIntervals) intervalCount_++;
          ratio_ = (sqrtf(redMs_) / redDc_) / (irRms / irDc_);
          updateValues();
        } else {
          intervalCount_ = 0;  // se perdieron latidos: los intervalos viejos ya no sirven
          intervalHead_ = 0;
        }
        lastBeat_ = beat;
      }
      // Más cerca que minBeatMs: muesca dicrótica o ruido, se ignora.
    }
  }
  prev2_ = prev1_;
  prev1_ = pulse;

  // Sin latidos regulares durante holdMs, el último valor deja de valer.
  if (hr_ && n_ - lastValidSample_ > msToSamples(p_.holdMs)) {
    hr_.reset();
    spo2_.reset();
  }
}

void PulseOxEstimator::updateValues() {
  if (intervalCount_ < p_.minIntervals) return;
  float sorted[kMaxIntervals];
  for (uint8_t i = 0; i < intervalCount_; i++) sorted[i] = intervals_[i];
  const float med = median(sorted, intervalCount_);
  float dev[kMaxIntervals];
  for (uint8_t i = 0; i < intervalCount_; i++) dev[i] = fabsf(intervals_[i] - med);
  const float mad = median(dev, intervalCount_);
  if (med <= 0.0f || mad / med > p_.maxIntervalSpread) return;  // irregular: queda el último valor

  hr_ = static_cast<uint16_t>(lroundf(60.0f * p_.sampleRateHz / med));
  spo2_ = static_cast<uint8_t>(lroundf(spo2FromRatio(ratio_)));
  lastValidSample_ = n_;
}

}  // namespace ppg
