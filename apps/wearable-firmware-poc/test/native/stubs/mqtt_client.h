#pragma once
#include <stdint.h>
using esp_event_base_t = const char*;
using esp_mqtt_client_handle_t = void*;
constexpr int ESP_OK = 0;
enum esp_mqtt_event_id_t { MQTT_EVENT_ANY, MQTT_EVENT_CONNECTED, MQTT_EVENT_DISCONNECTED,
  MQTT_EVENT_SUBSCRIBED, MQTT_EVENT_DATA, MQTT_EVENT_PUBLISHED, MQTT_EVENT_DELETED };
struct esp_mqtt_client_config_t {
  const char* uri; const char* client_id; const char* username; const char* password;
  int keepalive; int buffer_size; int reconnect_timeout_ms;
};
struct esp_mqtt_event_t {
  int msg_id = 0;
  char* topic = nullptr; int topic_len = 0;
  char* data = nullptr; int data_len = 0;
  int total_data_len = 0; int current_data_offset = 0;
  bool retain = false;
};
using Handler = void (*)(void*, esp_event_base_t, int32_t, void*);
esp_mqtt_client_handle_t esp_mqtt_client_init(const esp_mqtt_client_config_t* config);
int esp_mqtt_client_register_event(esp_mqtt_client_handle_t, int, Handler handler, void* context);
int esp_mqtt_client_start(esp_mqtt_client_handle_t);
int esp_mqtt_client_subscribe(esp_mqtt_client_handle_t, const char* filter, int qos);
int esp_mqtt_client_enqueue(esp_mqtt_client_handle_t, const char*, const char*, int, int, int, bool);
int esp_mqtt_client_get_outbox_size(esp_mqtt_client_handle_t);
