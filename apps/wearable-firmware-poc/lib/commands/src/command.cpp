#include "command.h"
#include <ArduinoJson.h>
#include <string.h>

namespace commands {
namespace {
// Reader con posición para rechazar basura después del objeto (ArduinoJson termina en '}').
struct Reader {
  const char* data;
  size_t length;
  size_t position = 0;
  int read() { return position < length ? static_cast<unsigned char>(data[position++]) : -1; }
  size_t readBytes(char* out, size_t count) {
    size_t available = length - position;
    if (count > available) count = available;
    memcpy(out, data + position, count);
    position += count;
    return count;
  }
};

bool whitespace(char c) { return c == ' ' || c == '\t' || c == '\r' || c == '\n'; }

// UTF-8 estricto: evita cortes, controles y secuencias inválidas en el OLED.
bool nextCodepoint(const char* data, size_t length, size_t& position, uint32_t& cp) {
  if (position >= length) return false;
  const unsigned char first = data[position++];
  size_t remaining;
  uint32_t minimum;
  if (first < 0x80) { cp = first; return true; }
  if (first >= 0xc2 && first <= 0xdf) { cp = first & 0x1f; remaining = 1; minimum = 0x80; }
  else if (first >= 0xe0 && first <= 0xef) { cp = first & 0x0f; remaining = 2; minimum = 0x800; }
  else if (first >= 0xf0 && first <= 0xf4) { cp = first & 0x07; remaining = 3; minimum = 0x10000; }
  else return false;
  while (remaining--) {
    if (position >= length) return false;
    const unsigned char byte = data[position++];
    if ((byte & 0xc0) != 0x80) return false;
    cp = (cp << 6) | (byte & 0x3f);
  }
  return cp >= minimum && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
}

bool copyText(JsonVariantConst value, char* out, size_t capacity) {
  if (!value.is<const char*>()) return false;
  const JsonString text = value.as<JsonString>();
  if (text.size() == 0 || text.size() >= capacity) return false;
  size_t position = 0;
  bool visible = false;
  while (position < text.size()) {
    uint32_t cp;
    if (!nextCodepoint(text.c_str(), text.size(), position, cp) || cp < 32 || (cp >= 127 && cp <= 159)) return false;
    if (cp != ' ' && cp != 0xa0) visible = true;
  }
  if (!visible) return false;
  memcpy(out, text.c_str(), text.size());
  out[text.size()] = '\0';
  return true;
}

char glyph(uint32_t cp) {
  if (cp >= 32 && cp < 127) return static_cast<char>(cp);
  switch (cp) {
    case 0xc1: case 0xc0: case 0xc4: return 'A';
    case 0xe1: case 0xe0: case 0xe4: return 'a';
    case 0xc9: case 0xc8: case 0xcb: return 'E';
    case 0xe9: case 0xe8: case 0xeb: return 'e';
    case 0xcd: case 0xcc: case 0xcf: return 'I';
    case 0xed: case 0xec: case 0xef: return 'i';
    case 0xd3: case 0xd2: case 0xd6: return 'O';
    case 0xf3: case 0xf2: case 0xf6: return 'o';
    case 0xda: case 0xd9: case 0xdc: return 'U';
    case 0xfa: case 0xf9: case 0xfc: return 'u';
    case 0xd1: return 'N'; case 0xf1: return 'n';
    case 0xa0: return ' ';
    default: return '?';
  }
}

void displayText(const char* text, char* out, size_t capacity, uint32_t step) {
  char ascii[vitalia::COMMAND_CONSULTING_ROOM_BYTES + 1] = {};
  size_t position = 0, count = 0, length = strlen(text);
  while (position < length && count < sizeof(ascii) - 1) {
    uint32_t cp;
    if (!nextCodepoint(text, length, position, cp)) break;
    ascii[count++] = glyph(cp);
  }
  const size_t columns = capacity - 1;
  if (count <= columns) { memcpy(out, ascii, count); out[count] = '\0'; return; }
  constexpr size_t gap = 3;
  const size_t start = step % (count + gap);
  for (size_t i = 0; i < columns; i++) {
    const size_t at = (start + i) % (count + gap);
    out[i] = at < count ? ascii[at] : ' ';
  }
  out[columns] = '\0';
}
}  // namespace

bool parseShowTicket(const char* payload, size_t length, ShowTicket& out) {
  if (!payload || length == 0 || length > vitalia::COMMAND_PAYLOAD_BYTES || memchr(payload, '\0', length)) return false;
  Reader reader{payload, length};
  JsonDocument doc;
  if (deserializeJson(doc, reader, DeserializationOption::NestingLimit(2)) || !doc.is<JsonObject>()) return false;
  while (reader.position < length) if (!whitespace(payload[reader.position++])) return false;
  JsonObjectConst object = doc.as<JsonObjectConst>();
  if (object.size() != 3 || !object["type"].is<const char*>() ||
      object["type"].as<JsonString>().size() != strlen(vitalia::CMD_SHOW_TICKET) ||
      strcmp(object["type"].as<const char*>(), vitalia::CMD_SHOW_TICKET) != 0) return false;
  ShowTicket candidate;
  if (!copyText(object["ticketCode"], candidate.ticketCode, sizeof(candidate.ticketCode)) ||
      !copyText(object["consultingRoom"], candidate.consultingRoom, sizeof(candidate.consultingRoom))) return false;
  out = candidate;
  return true;
}

bool CommandInbox::configure(const char* filter) {
  reset();
  filter_[0] = '\0';
  if (!filter || strlen(filter) >= sizeof(filter_)) return false;
  const char* wildcard = strchr(filter, '+');
  if (!wildcard || strchr(wildcard + 1, '+') || strchr(filter, '#')) return false;
  strcpy(filter_, filter);
  return true;
}

void CommandInbox::reset() { expected_ = received_ = 0; }

bool CommandInbox::matches(const char* topic, size_t length) const {
  const char* wildcard = strchr(filter_, '+');
  if (!topic || !wildcard) return false;
  size_t prefix = wildcard - filter_, suffix = strlen(wildcard + 1);
  if (length <= prefix + suffix || memcmp(topic, filter_, prefix) != 0 ||
      memcmp(topic + length - suffix, wildcard + 1, suffix) != 0) return false;
  for (size_t i = prefix; i < length - suffix; i++)
    if (topic[i] == '/' || topic[i] == '+' || topic[i] == '#' || topic[i] == '\0') return false;
  return true;
}

bool CommandInbox::receive(const char* topic, size_t topicLength, const char* data, size_t length,
                          size_t total, size_t offset, bool retained, ShowTicket& out) {
  if (offset == 0) {
    reset();
    if (retained || !matches(topic, topicLength) || total == 0 || total > sizeof(payload_)) return false;
    expected_ = total;
  }
  if (!expected_ || total != expected_ || offset != received_ || !data || length == 0 ||
      length > expected_ - received_) { reset(); return false; }
  memcpy(payload_ + received_, data, length);
  received_ += length;
  if (received_ != expected_) return false;
  const bool accepted = parseShowTicket(payload_, received_, out);
  reset();
  return accepted;
}

bool CallState::apply(const ShowTicket& command, uint32_t now) {
  if (active_ && strcmp(command_.ticketCode, command.ticketCode) == 0 &&
      strcmp(command_.consultingRoom, command.consultingRoom) == 0) return false;
  command_ = command;
  receivedAt_ = now;
  active_ = true;
  return true;
}

CallFrame CallState::frame(uint32_t now, bool connected, uint32_t scrollMs) const {
  CallFrame result;
  if (!active_) return result;
  strcpy(result.title, connected ? "TE LLAMAN" : "LLAMADO SIN RED");
  const uint32_t step = scrollMs == 0 ? 0 : (now - receivedAt_) / scrollMs;
  displayText(command_.ticketCode, result.ticket, sizeof(result.ticket), step);
  displayText(command_.consultingRoom, result.room, sizeof(result.room), step);
  return result;
}
}  // namespace commands
