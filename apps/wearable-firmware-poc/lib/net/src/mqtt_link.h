#pragma once
/**
 * Cliente MQTT sobre ESP-MQTT (incluido en el core, ADR 0012): QoS 1 real con reintentos
 * y outbox. Corre en su propia tarea de FreeRTOS, así que no bloquea el loop().
 *
 * Límite conocido: el outbox de esta versión del core descarta los mensajes que no se
 * pudieron entregar después de 30 s (OUTBOX_EXPIRED_TIMEOUT_MS, fijo en el SDK). Cubre
 * cortes cortos del broker; para cortes largos hace falta un buffer propio (roadmap F5).
 */
#include <mqtt_client.h>
#include <stdint.h>

namespace net {

class MqttLink {
 public:
  /**
   * Configura el cliente. `user`/`pass` vacíos = conexión anónima (Mosquitto de desarrollo).
   * No conecta todavía: llamar a start() cuando haya Wi-Fi.
   */
  bool begin(const char* host, uint16_t port, const char* clientId, const char* user, const char* pass);
  /** Arranca la conexión (idempotente). Después reconecta solo. */
  void start();
  bool connected() const { return connected_; }

  /**
   * Encola el mensaje en el outbox y vuelve enseguida; lo envía la tarea de ESP-MQTT.
   * Con QoS 1 se reintenta hasta el PUBACK. Devuelve false si no se pudo encolar.
   */
  bool publish(const char* topic, const char* payload, int qos);

  /** Bytes pendientes en el outbox (sin PUBACK todavía). */
  int outboxBytes() const;
  /** PUBACKs recibidos desde el arranque (mensajes QoS 1 confirmados por el broker). */
  uint32_t acked() const { return acked_; }

 private:
  static void onEvent(void* self, esp_event_base_t base, int32_t eventId, void* eventData);

  esp_mqtt_client_handle_t client_ = nullptr;
  bool started_ = false;
  volatile bool connected_ = false;
  volatile uint32_t acked_ = 0;
  char uri_[64] = {0};
};

}  // namespace net
