#pragma once
/**
 * Detección de caídas en el dispositivo (Hito 8), con las tres fases del marco teórico:
 *
 *   1. Caída libre: |a| < freeFallG durante al menos freeFallMinMs.
 *   2. Impacto: |a| > impactG (vitalia::FALL_IMPACT_G = 2,8 g) dentro de impactWindowMs
 *      desde que terminó la caída libre.
 *   3. Inmovilidad: pasados settleMs (rebotes del golpe), |a| se queda a ±stillToleranceG
 *      de restG (1 g) durante stillMs. Si hay movimiento antes, no es una caída: el
 *      paciente se levantó o fue un golpe de la mano contra algo.
 *
 * Sin Arduino: el tiempo entra por parámetro (`millis()`), así se testea en native con
 * trazas sintéticas. Los valores por defecto de FallParams son el punto de partida; se
 * calibran con el hardware (AGENTS.md §7) y el firmware los pasa desde config.h.
 */
#include <stdint.h>

#include "vitalia_contracts.h"

namespace fall_detection {

struct FallParams {
  float impactG = vitalia::FALL_IMPACT_G;
  float freeFallG = 0.4f;
  uint32_t freeFallMinMs = 60;     // 3 muestras a 50 Hz
  uint32_t impactWindowMs = 1000;  // fin de la caída libre → impacto
  uint32_t settleMs = 500;         // se ignoran los rebotes después del impacto
  uint32_t stillMs = 2000;         // inmovilidad que confirma la caída
  float restG = 1.0f;
  float stillToleranceG = 0.3f;
  // false: alcanza con impacto + inmovilidad. Para una muñeca que no registra bien la
  // caída libre (la decisión sale de los ensayos del Hito 8).
  bool requireFreeFall = true;
};

enum class FallState : uint8_t { Idle, FreeFall, AwaitImpact, Settling, CheckStill };

inline const char* stateName(FallState s) {
  switch (s) {
    case FallState::Idle: return "IDLE";
    case FallState::FreeFall: return "FREE_FALL";
    case FallState::AwaitImpact: return "AWAIT_IMPACT";
    case FallState::Settling: return "SETTLING";
    case FallState::CheckStill: return "CHECK_STILL";
  }
  return "?";
}

class FallDetector {
 public:
  FallDetector() = default;
  explicit FallDetector(const FallParams& params) : p_(params) {}

  /**
   * Una muestra del IMU: magnitud de la aceleración en g y `millis()` del momento.
   * Devuelve true solo en la muestra que confirma la caída (para publicar sin esperar
   * el ciclo de 3 s). Las muestras inválidas (NaN o negativas) se ignoran.
   */
  bool update(float accelG, uint32_t nowMs) {
    if (!(accelG >= 0.0f)) return false;
    bool impact = accelG > p_.impactG;
    if (impact) {
      hasImpact_ = true;
      lastImpactMs_ = nowMs;
    }

    switch (state_) {
      case FallState::Idle:
        if (p_.requireFreeFall) {
          if (accelG < p_.freeFallG) enter(FallState::FreeFall, nowMs);
        } else if (impact) {
          enter(FallState::Settling, nowMs);
        }
        break;

      case FallState::FreeFall:
        if (accelG < p_.freeFallG) break;
        if (nowMs - since_ < p_.freeFallMinMs) enter(FallState::Idle, nowMs);  // vibración, no caída
        else if (impact) enter(FallState::Settling, nowMs);  // la caída libre termina en el golpe
        else enter(FallState::AwaitImpact, nowMs);
        break;

      case FallState::AwaitImpact:
        if (impact) enter(FallState::Settling, nowMs);
        else if (nowMs - since_ > p_.impactWindowMs) enter(FallState::Idle, nowMs);
        break;

      case FallState::Settling:
        if (nowMs - since_ >= p_.settleMs) enter(FallState::CheckStill, nowMs);
        break;

      case FallState::CheckStill: {
        float delta = accelG - p_.restG;
        if (delta > p_.stillToleranceG || delta < -p_.stillToleranceG) {
          enter(FallState::Idle, nowMs);  // se movió: no es una caída
        } else if (nowMs - since_ >= p_.stillMs) {
          enter(FallState::Idle, nowMs);
          pending_ = true;
          hasFall_ = true;
          lastFallMs_ = nowMs;
          return true;
        }
        break;
      }
    }
    return false;
  }

  /** `fall` de la próxima lectura: true si se confirmó una caída desde la anterior. Limpia el flag. */
  bool take() {
    bool fall = pending_;
    pending_ = false;
    return fall;
  }

  /** Para la UI: se confirmó una caída en los últimos `windowMs`. */
  bool recentFall(uint32_t nowMs, uint32_t windowMs) const {
    return hasFall_ && nowMs - lastFallMs_ <= windowMs;
  }

  /** Diagnóstico para calibrar: hubo un impacto (> impactG) en los últimos `windowMs`, fuera o no una caída. */
  bool recentImpact(uint32_t nowMs, uint32_t windowMs) const {
    return hasImpact_ && nowMs - lastImpactMs_ <= windowMs;
  }

  FallState state() const { return state_; }

 private:
  void enter(FallState next, uint32_t nowMs) {
    state_ = next;
    since_ = nowMs;
  }

  FallParams p_;
  FallState state_ = FallState::Idle;
  uint32_t since_ = 0;  // millis() de entrada al estado actual
  bool pending_ = false;
  bool hasFall_ = false;
  uint32_t lastFallMs_ = 0;
  bool hasImpact_ = false;
  uint32_t lastImpactMs_ = 0;
};

}  // namespace fall_detection
