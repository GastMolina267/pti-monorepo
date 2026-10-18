#include <unity.h>
#include <string.h>
#include <string>
#include "command.h"

const char* valid = "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"Consultorio 4\"}";
const char* topic = "hospital/sala1/wearable/wb-01-24d7cc/cmd";
const char* filter = "hospital/+/wearable/wb-01-24d7cc/cmd";
void setUp() {}
void tearDown() {}

void test_valid_command_and_non_terminated_input() {
  commands::ShowTicket out;
  std::string data = std::string(valid) + "basura";
  TEST_ASSERT_TRUE(commands::parseShowTicket(data.data(), strlen(valid), out));
  TEST_ASSERT_EQUAL_STRING("A-024", out.ticketCode);
  TEST_ASSERT_EQUAL_STRING("Consultorio 4", out.consultingRoom);
}

void test_rejects_invalid_json_shape_and_strings_without_changing_output() {
  const char* invalid[] = {"", "null", "[]", "{}", "{", "{}{}",
    "{\"type\":\"OTHER\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":12,\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":null,\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"\",\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"   \",\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\\u0000X\",\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\\u0000\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"C4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"C\\n4\"}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\",\"consultingRoom\":\"C4\",\"extra\":1}",
    "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"A-024\"}"};
  commands::ShowTicket out;
  strcpy(out.ticketCode, "ORIGINAL");
  for (const char* payload : invalid) {
    TEST_ASSERT_FALSE_MESSAGE(commands::parseShowTicket(payload, strlen(payload), out), payload);
    TEST_ASSERT_EQUAL_STRING("ORIGINAL", out.ticketCode);
  }
  std::string trailing = std::string(valid) + " no";
  TEST_ASSERT_FALSE(commands::parseShowTicket(trailing.data(), trailing.size(), out));
  trailing = std::string(valid) + "X";
  TEST_ASSERT_FALSE(commands::parseShowTicket(trailing.data(), trailing.size(), out));
  trailing = std::string(valid) + "}";
  TEST_ASSERT_FALSE(commands::parseShowTicket(trailing.data(), trailing.size(), out));
  trailing = std::string(valid) + "\r\n \t";
  TEST_ASSERT_TRUE(commands::parseShowTicket(trailing.data(), trailing.size(), out));
}

void test_contract_limits_and_utf8() {
  auto payload = [](const std::string& code, const std::string& room) {
    return "{\"type\":\"SHOW_TICKET\",\"ticketCode\":\"" + code + "\",\"consultingRoom\":\"" + room + "\"}";
  };
  commands::ShowTicket out;
  std::string data = payload(std::string(vitalia::COMMAND_TICKET_CODE_BYTES, 'A'), std::string(vitalia::COMMAND_CONSULTING_ROOM_BYTES, 'B'));
  TEST_ASSERT_TRUE(commands::parseShowTicket(data.data(), data.size(), out));
  data = payload(std::string(vitalia::COMMAND_TICKET_CODE_BYTES + 1, 'A'), "C4");
  TEST_ASSERT_FALSE(commands::parseShowTicket(data.data(), data.size(), out));
  data = payload("A-024", std::string(vitalia::COMMAND_CONSULTING_ROOM_BYTES + 1, 'B'));
  TEST_ASSERT_FALSE(commands::parseShowTicket(data.data(), data.size(), out));
  data = payload("A-024", "Clínica del Niño");
  TEST_ASSERT_TRUE(commands::parseShowTicket(data.data(), data.size(), out));
  TEST_ASSERT_EQUAL_STRING("Clínica del Niño", out.consultingRoom);
  data = payload("A-024", std::string("\xc0\xaf", 2)); // UTF-8 overlong
  TEST_ASSERT_FALSE(commands::parseShowTicket(data.data(), data.size(), out));
  data = payload("A-024", std::string("\xed\xa0\x80", 3)); // surrogate
  TEST_ASSERT_FALSE(commands::parseShowTicket(data.data(), data.size(), out));
  data = std::string(vitalia::COMMAND_PAYLOAD_BYTES + 1, ' ');
  TEST_ASSERT_FALSE(commands::parseShowTicket(data.data(), data.size(), out));
  TEST_ASSERT_FALSE(commands::parseShowTicket(nullptr, 1, out));
}

void test_fragments_and_foreign_topics() {
  commands::CommandInbox inbox;
  TEST_ASSERT_TRUE(inbox.configure(filter));
  commands::ShowTicket out;
  const size_t length = strlen(valid), split = length / 2;
  TEST_ASSERT_FALSE(inbox.receive(topic, strlen(topic), valid, split, length, 0, false, out));
  TEST_ASSERT_TRUE(inbox.receive(nullptr, 0, valid + split, length - split, length, split, false, out));
  TEST_ASSERT_EQUAL_STRING("A-024", out.ticketCode);
  const char* foreign[] = {"hospital/sala1/wearable/wb-02-5e0002/cmd", "hospital/sala1/wearable/wb-01-24d7cc/data", "hospital//wearable/wb-01-24d7cc/cmd", "hospital/a/b/wearable/wb-01-24d7cc/cmd"};
  for (const char* t : foreign) TEST_ASSERT_FALSE(inbox.receive(t, strlen(t), valid, length, length, 0, false, out));
  const char* otherRoom = "hospital/otra-sala/wearable/wb-01-24d7cc/cmd";
  TEST_ASSERT_TRUE(inbox.receive(otherRoom, strlen(otherRoom), valid, length, length, 0, false, out));
}

void test_retained_oversized_and_incomplete_messages_never_apply() {
  commands::CommandInbox inbox;
  inbox.configure(filter);
  commands::ShowTicket out;
  const size_t n = strlen(valid), split = n / 2;
  TEST_ASSERT_FALSE(inbox.receive(topic, strlen(topic), valid, n, n, 0, true, out));
  TEST_ASSERT_FALSE(inbox.receive(topic, strlen(topic), valid, n, vitalia::COMMAND_PAYLOAD_BYTES + 1, 0, false, out));
  TEST_ASSERT_FALSE(inbox.receive(topic, strlen(topic), valid, split, n, 0, false, out));
  TEST_ASSERT_FALSE(inbox.receive(nullptr, 0, valid + split, n - split, n, split + 1, false, out));
  TEST_ASSERT_FALSE(inbox.receive(nullptr, 0, valid + split, n - split, n, split, false, out));
  TEST_ASSERT_FALSE(inbox.receive(topic, strlen(topic), valid, split, n, 0, false, out));
  inbox.reset(); // desconexión: no combinar fragmentos de sesiones distintas
  TEST_ASSERT_FALSE(inbox.receive(nullptr, 0, valid + split, n - split, n, split, false, out));
  TEST_ASSERT_TRUE(inbox.receive(topic, strlen(topic), valid, n, n, 0, false, out));
}

void test_call_replacement_duplicates_and_disconnect_preserve_state() {
  commands::CallState state;
  TEST_ASSERT_FALSE(state.active());
  TEST_ASSERT_EQUAL_STRING("", state.frame(0, true, 500).title);
  commands::ShowTicket command;
  TEST_ASSERT_TRUE(commands::parseShowTicket(valid, strlen(valid), command));
  TEST_ASSERT_TRUE(state.apply(command, 100));
  TEST_ASSERT_TRUE(state.active());
  TEST_ASSERT_EQUAL_STRING("TE LLAMAN", state.frame(100, true, 500).title);
  TEST_ASSERT_EQUAL_STRING("LLAMADO SIN RED", state.frame(200, false, 500).title);
  TEST_ASSERT_EQUAL_STRING("A-024", state.frame(200, false, 500).ticket);
  TEST_ASSERT_FALSE(state.apply(command, 200));
  strcpy(command.ticketCode, "B-010");
  TEST_ASSERT_TRUE(state.apply(command, 300));
  TEST_ASSERT_EQUAL_STRING("B-010", state.frame(300, true, 500).ticket);
}

void test_oled_transliterates_and_scrolls_without_splitting_utf8() {
  commands::ShowTicket command;
  strcpy(command.ticketCode, "A-024");
  strcpy(command.consultingRoom, "Clínica del Niño");
  commands::CallState state;
  state.apply(command, 0);
  TEST_ASSERT_EQUAL_STRING("Clinica del Nino", state.frame(0, true, 500).room);
  strcpy(command.consultingRoom, "Consultorio de Clínica Pediátrica");
  state.apply(command, UINT32_MAX - 499);
  TEST_ASSERT_EQUAL_STRING("Consultorio de Clinic", state.frame(UINT32_MAX - 499, true, 500).room);
  TEST_ASSERT_EQUAL_STRING("onsultorio de Clinica", state.frame(0, true, 500).room);
  TEST_ASSERT_FALSE(state.apply(command, 0));
  TEST_ASSERT_EQUAL_STRING("onsultorio de Clinica", state.frame(0, true, 500).room);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_valid_command_and_non_terminated_input);
  RUN_TEST(test_rejects_invalid_json_shape_and_strings_without_changing_output);
  RUN_TEST(test_contract_limits_and_utf8);
  RUN_TEST(test_fragments_and_foreign_topics);
  RUN_TEST(test_retained_oversized_and_incomplete_messages_never_apply);
  RUN_TEST(test_call_replacement_duplicates_and_disconnect_preserve_state);
  RUN_TEST(test_oled_transliterates_and_scrolls_without_splitting_utf8);
  return UNITY_END();
}
