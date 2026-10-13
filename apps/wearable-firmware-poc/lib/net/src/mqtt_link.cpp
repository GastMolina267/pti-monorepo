#include "mqtt_link.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

namespace net {

namespace {
// Un sobre con una TelemetryReading completa ronda los 300 bytes (AGENTS.md §3).
constexpr int kBufferSize = 1024;
constexpr int kKeepaliveS = 30;
constexpr int kReconnectMs = 5000;
}  // namespace

bool MqttLink::begin(const char* host, uint16_t port, const char* clientId, const char* user,
                     const char* pass) {
  snprintf(uri_, sizeof(uri_), "mqtt://%s:%u", host, static_cast<unsigned>(port));

  esp_mqtt_client_config_t cfg = {};
  cfg.uri = uri_;
  cfg.client_id = clientId;  // ESP-MQTT copia los strings de la config
  cfg.username = (user && user[0]) ? user : nullptr;
  cfg.password = (pass && pass[0]) ? pass : nullptr;
  cfg.keepalive = kKeepaliveS;
  cfg.buffer_size = kBufferSize;
  cfg.reconnect_timeout_ms = kReconnectMs;

  client_ = esp_mqtt_client_init(&cfg);
  if (client_ == nullptr) return false;
  esp_mqtt_client_register_event(client_, MQTT_EVENT_ANY, &MqttLink::onEvent, this);
  return true;
}

void MqttLink::start() {
  if (client_ == nullptr || started_) return;
  started_ = esp_mqtt_client_start(client_) == ESP_OK;
}

bool MqttLink::publish(const char* topic, const char* payload, int qos) {
  if (client_ == nullptr) return false;
  // store = true: el mensaje queda en el outbox aunque en este momento no haya conexión.
  int msgId = esp_mqtt_client_enqueue(client_, topic, payload, static_cast<int>(strlen(payload)), qos,
                                      /*retain=*/0, /*store=*/true);
  return msgId >= 0;
}

int MqttLink::outboxBytes() const {
  return client_ == nullptr ? 0 : esp_mqtt_client_get_outbox_size(client_);
}

void MqttLink::onEvent(void* self, esp_event_base_t, int32_t eventId, void*) {
  auto* link = static_cast<MqttLink*>(self);
  switch (static_cast<esp_mqtt_event_id_t>(eventId)) {
    case MQTT_EVENT_CONNECTED:
      link->connected_ = true;
      Serial.printf("MQTT OK (%s)\n", link->uri_);
      break;
    case MQTT_EVENT_DISCONNECTED:
      if (link->connected_) Serial.println(F("MQTT: desconectado"));
      link->connected_ = false;
      break;
    case MQTT_EVENT_PUBLISHED:
      link->acked_ = link->acked_ + 1;
      break;
    case MQTT_EVENT_DELETED:
      // El outbox descartó un mensaje vencido (30 s sin PUBACK): se perdió esa lectura.
      Serial.println(F("MQTT: lectura descartada del outbox (broker caído > 30 s)"));
      break;
    default:
      break;
  }
}

}  // namespace net
