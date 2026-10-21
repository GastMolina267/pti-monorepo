#pragma once
/** Wi-Fi (solo 2.4 GHz) con reintento no bloqueante. */
#include <stdint.h>

namespace net {

enum class LinkEvent { None, Connected, Disconnected };

class WifiLink {
 public:
  /** `txPowerQuarterDbm` en cuartos de dBm (`wifi_power_t`): 34 = 8,5 dBm. */
  void begin(const char* ssid, const char* pass, int8_t txPowerQuarterDbm);
  /**
   * Llamar en cada vuelta del loop. Si está caído, reintenta `retryMs` después de que el
   * intento anterior falló (el primer WiFi.begin() después del boot suele fallar: ESTADO.md,
   * Hito 6a), o a los `attemptTimeoutMs` si no terminó. No corta un intento en curso: la
   * asociación + WPA + DHCP puede tardar más de `retryMs`. Imprime el motivo de cada fallo.
   * Devuelve el flanco de conexión o desconexión, si hubo.
   */
  LinkEvent loop(uint32_t nowMs, uint32_t retryMs, uint32_t attemptTimeoutMs);
  bool connected() const;

 private:
  void connect();
  const char* ssid_ = nullptr;
  const char* pass_ = nullptr;
  int8_t txPower_ = 0;
  uint32_t lastAttemptMs_ = 0;
  uint32_t seenFailures_ = 0;
  bool failedSinceAttempt_ = false;
  bool wasConnected_ = false;
};

}  // namespace net
