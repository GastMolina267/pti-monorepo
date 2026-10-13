#pragma once
/** Identidad del dispositivo: código wb-<NN>-<mac> y contador de arranques para `seq`. */
#include <stddef.h>
#include <stdint.h>

namespace net {

/** Arma el código con el número físico (secrets.h) y la MAC Wi-Fi del chip. */
bool deviceCode(char* out, size_t outLen, int wearableNumber);

/**
 * Incrementa y devuelve el contador de arranques guardado en NVS (namespace
 * `vitalia`, clave `boot`). Una sola escritura de flash por arranque.
 */
uint32_t nextBootCount();

}  // namespace net
