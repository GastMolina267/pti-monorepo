#pragma once
/** Comandos y estado de pantalla puros: sin Arduino, red, I²C ni FreeRTOS. */
#include <stddef.h>
#include <stdint.h>
#include "vitalia_contracts.h"

namespace commands {

struct ShowTicket {
  char ticketCode[vitalia::COMMAND_TICKET_CODE_BYTES + 1] = {};
  char consultingRoom[vitalia::COMMAND_CONSULTING_ROOM_BYTES + 1] = {};
};

/** Solo modifica out cuando el JSON completo es válido. */
bool parseShowTicket(const char* payload, size_t length, ShowTicket& out);

/** Reensambla una publicación ESP-MQTT; un fragmento inválido descarta toda la recepción. */
class CommandInbox {
 public:
  bool configure(const char* filter);
  void reset();
  bool receive(const char* topic, size_t topicLength, const char* data, size_t length,
               size_t total, size_t offset, bool retained, ShowTicket& out);
 private:
  // El filtro generado solo usa '+' en el segmento de sala; alcanza para cualquier ID del contrato.
  char filter_[128] = {};
  char payload_[vitalia::COMMAND_PAYLOAD_BYTES] = {};
  size_t expected_ = 0;
  size_t received_ = 0;
  bool matches(const char* topic, size_t length) const;
};

constexpr size_t DISPLAY_COLUMNS = 21;  // fuente 6 px en SSD1306 de 128 px
struct CallFrame {
  char title[DISPLAY_COLUMNS + 1] = {};
  char ticket[DISPLAY_COLUMNS + 1] = {};
  char room[DISPLAY_COLUMNS + 1] = {};
};

/** Último llamado válido en RAM hasta el siguiente o reinicio; los duplicados son idempotentes. */
class CallState {
 public:
  bool apply(const ShowTicket& command, uint32_t now);
  bool active() const { return active_; }
  const ShowTicket& command() const { return command_; }
  CallFrame frame(uint32_t now, bool connected, uint32_t scrollMs) const;
 private:
  ShowTicket command_;
  uint32_t receivedAt_ = 0;
  bool active_ = false;
};

}  // namespace commands
