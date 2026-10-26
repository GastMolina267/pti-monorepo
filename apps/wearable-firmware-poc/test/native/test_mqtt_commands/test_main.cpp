// Compila el adaptador REAL contra un SDK mínimo de prueba; no simula su lógica de eventos.
#include <unity.h>
#include <string.h>
#include <vector>
#include "command.h"
#include "../../../lib/net/src/mqtt_link.cpp"

SerialStub Serial;
struct QueueStub { std::vector<unsigned char> data; bool pending = false; };
static std::vector<QueueHandle_t> queues;
static Handler callback;
static void* context;
static int subscriptions, lastId, lastQos;
static bool initFails;
static char lastFilter[128];
static const char* filter = "hospital/+/wearable/wb-01-24d7cc/cmd";
static const char* topic = "hospital/sala1/wearable/wb-01-24d7cc/cmd";
static const char* payload = "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"Consultorio 4\"}";

QueueHandle_t xQueueCreate(size_t count, size_t size) {
  TEST_ASSERT_EQUAL(1, count);
  auto* queue = new QueueStub{std::vector<unsigned char>(size), false};
  queues.push_back(queue);
  return queue;
}
void vQueueDelete(QueueHandle_t queue) {
  for (auto& current : queues) if (current == queue) current = nullptr;
  delete queue;
}
int xQueueReceive(QueueHandle_t queue, void* out, TickType_t timeout) {
  TEST_ASSERT_EQUAL(0, timeout);
  if (!queue->pending) return 0;
  memcpy(out, queue->data.data(), queue->data.size());
  queue->pending = false;
  return pdTRUE;
}
int xQueueOverwrite(QueueHandle_t queue, const void* in) {
  memcpy(queue->data.data(), in, queue->data.size());
  queue->pending = true;
  return pdTRUE;
}
esp_mqtt_client_handle_t esp_mqtt_client_init(const esp_mqtt_client_config_t*) { return initFails ? nullptr : &subscriptions; }
int esp_mqtt_client_register_event(esp_mqtt_client_handle_t, int, Handler handler, void* self) { callback = handler; context = self; return ESP_OK; }
int esp_mqtt_client_start(esp_mqtt_client_handle_t) { return ESP_OK; }
int esp_mqtt_client_subscribe(esp_mqtt_client_handle_t, const char* value, int qos) {
  strcpy(lastFilter, value);
  lastQos = qos;
  return lastId = ++subscriptions;
}
int esp_mqtt_client_enqueue(esp_mqtt_client_handle_t, const char*, const char*, int, int, int, bool) { return 1; }
int esp_mqtt_client_get_outbox_size(esp_mqtt_client_handle_t) { return 0; }

void setUp() { callback = nullptr; context = nullptr; subscriptions = lastId = lastQos = 0; initFails = false; }
void tearDown() { for (auto* queue : queues) delete queue; queues.clear(); }
static void emit(esp_mqtt_event_id_t type, esp_mqtt_event_t* event = nullptr) { callback(context, nullptr, type, event); }
static void deliver(const char* data, size_t length, size_t total, size_t offset, bool retained = false) {
  esp_mqtt_event_t event;
  event.topic = offset == 0 ? const_cast<char*>(topic) : nullptr;
  event.topic_len = offset == 0 ? strlen(topic) : 0;
  event.data = const_cast<char*>(data); event.data_len = length;
  event.total_data_len = total; event.current_data_offset = offset; event.retain = retained;
  emit(MQTT_EVENT_DATA, &event);
}

void test_resubscribes_on_every_connection_and_waits_for_matching_suback() {
  net::MqttLink link;
  TEST_ASSERT_TRUE(link.begin("broker", 1883, "device", "", "", filter));
  emit(MQTT_EVENT_CONNECTED);
  TEST_ASSERT_TRUE(link.connected());
  TEST_ASSERT_FALSE(link.commandsReady());
  TEST_ASSERT_EQUAL_STRING(filter, lastFilter);
  TEST_ASSERT_EQUAL(vitalia::MQTT_QOS, lastQos);
  esp_mqtt_event_t ack; ack.msg_id = 999;
  emit(MQTT_EVENT_SUBSCRIBED, &ack);
  TEST_ASSERT_FALSE(link.commandsReady());
  ack.msg_id = lastId; emit(MQTT_EVENT_SUBSCRIBED, &ack);
  TEST_ASSERT_TRUE(link.commandsReady());
  emit(MQTT_EVENT_DISCONNECTED);
  TEST_ASSERT_FALSE(link.connected());
  TEST_ASSERT_FALSE(link.commandsReady());
  emit(MQTT_EVENT_CONNECTED);
  TEST_ASSERT_EQUAL(2, subscriptions);
  TEST_ASSERT_FALSE(link.commandsReady());
  ack.msg_id = lastId; emit(MQTT_EVENT_SUBSCRIBED, &ack);
  TEST_ASSERT_TRUE(link.commandsReady());
}

void test_fragmented_commands_cross_to_loop_only_when_complete() {
  net::MqttLink link; link.begin("broker", 1883, "device", "", "", filter);
  emit(MQTT_EVENT_CONNECTED);
  const size_t length = strlen(payload), split = length / 2;
  commands::Command out;
  deliver(payload, split, length, 0);
  TEST_ASSERT_FALSE(link.takeCommand(out));
  deliver(payload + split, length - split, length, split);
  TEST_ASSERT_TRUE(link.takeCommand(out));
  TEST_ASSERT_EQUAL_STRING("A-024", out.ticketCode);
  TEST_ASSERT_FALSE(link.takeCommand(out));
}

void test_disconnect_discards_partial_message_and_retained_cannot_replace_call() {
  net::MqttLink link; link.begin("broker", 1883, "device", "", "", filter);
  emit(MQTT_EVENT_CONNECTED);
  const size_t length = strlen(payload), split = length / 2;
  commands::Command out;
  deliver(payload, split, length, 0);
  emit(MQTT_EVENT_DISCONNECTED); emit(MQTT_EVENT_CONNECTED);
  deliver(payload + split, length - split, length, split);
  TEST_ASSERT_FALSE(link.takeCommand(out));
  deliver(payload, length, length, 0, true);
  TEST_ASSERT_FALSE(link.takeCommand(out));
  deliver(payload, length, length, 0);
  deliver("{}", 2, 2, 0);
  TEST_ASSERT_TRUE(link.takeCommand(out));
  TEST_ASSERT_EQUAL_STRING("A-024", out.ticketCode);
}

void test_queue_keeps_latest_call_and_failed_init_is_safe() {
  net::MqttLink link;
  commands::Command out;
  TEST_ASSERT_FALSE(link.takeCommand(out));
  initFails = true;
  TEST_ASSERT_FALSE(link.begin("broker", 1883, "device", "", "", filter));
  initFails = false;
  TEST_ASSERT_TRUE(link.begin("broker", 1883, "device", "", "", filter));
  deliver(payload, strlen(payload), strlen(payload), 0);
  const char* newer = "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"B-010\",\"consultingRoom\":\"C5\"}";
  deliver(newer, strlen(newer), strlen(newer), 0);
  TEST_ASSERT_TRUE(link.takeCommand(out));
  TEST_ASSERT_EQUAL_STRING("B-010", out.ticketCode);
  TEST_ASSERT_FALSE(link.takeCommand(out));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_resubscribes_on_every_connection_and_waits_for_matching_suback);
  RUN_TEST(test_fragmented_commands_cross_to_loop_only_when_complete);
  RUN_TEST(test_disconnect_discards_partial_message_and_retained_cannot_replace_call);
  RUN_TEST(test_queue_keeps_latest_call_and_failed_init_is_safe);
  return UNITY_END();
}
