#pragma once
/**
 * Hora para el `ts` del contrato (epoch en ms, UTC) vía NTP.
 * Desarrollo: NTP público (red única con internet). Producción: NTP local del
 * RUT956 / gateway, porque la VLAN 10 no tiene internet (roadmap Fase 4).
 */
#include <stdint.h>

namespace net {

/** Arranca SNTP contra `server`. Se puede llamar en cada reconexión. */
void startNtp(const char* server);
/** true cuando el reloj ya se sincronizó (antes de eso no se publican lecturas). */
bool timeValid();
/** Epoch actual en ms (solo tiene sentido si timeValid()). */
uint64_t nowMs();

}  // namespace net
