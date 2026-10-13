#pragma once
/**
 * Servidor HTTP de demo (puerto 80), hasta que exista MQTT (Hito 6b):
 *   /        página con la telemetría en vivo (sin recursos externos)
 *   /data    la última TelemetryReading, tal cual se va a publicar (503 sin hora NTP)
 *   /status  diagnóstico del dispositivo (no es parte del contrato)
 */
#include <Arduino.h>

namespace http_demo {

/** Escribe el JSON en `out`. Devuelve false si todavía no hay nada que mostrar (→ 503). */
using JsonProvider = bool (*)(String& out);

void begin(JsonProvider data, JsonProvider status);
void loop();

}  // namespace http_demo
