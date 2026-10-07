#pragma once
/** Wi-Fi (solo 2.4 GHz) con reintento no bloqueante. */
#include <stdint.h>

namespace net {

enum class LinkEvent { None, Connected, Disconnected };

class WifiLink {
 public:
  void begin(const char* ssid, const char* pass);
  /**
   * Llamar en cada vuelta del loop. Si está caído, reintenta cada `retryMs`
   * (el primer WiFi.begin() después del boot suele fallar: ESTADO.md, Hito 6a).
   * Devuelve el flanco de conexión o desconexión, si hubo.
   */
  LinkEvent loop(uint32_t nowMs, uint32_t retryMs);
  bool connected() const;

 private:
  void connect();
  const char* ssid_ = nullptr;
  const char* pass_ = nullptr;
  uint32_t lastAttemptMs_ = 0;
  bool wasConnected_ = false;
};

}  // namespace net
