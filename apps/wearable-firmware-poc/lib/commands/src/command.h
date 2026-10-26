#pragma once
/** Comandos y estado de pantalla puros: sin Arduino, red, I²C ni FreeRTOS. */
#include <stddef.h>
#include <stdint.h>

#include <optional>

#include "vitalia_contracts.h"

namespace commands {

/** Tipos de `WearableCommand` (contracts, ADR 0021). Cada uno lleva el estado completo. */
enum class CommandKind : uint8_t { ShowTicket, AssignTicket, ClearTicket, ReleaseWearable };

struct Command {
  CommandKind kind = CommandKind::ShowTicket;
  char ticketCode[vitalia::COMMAND_TICKET_CODE_BYTES + 1] = {};      // vacío en ReleaseWearable
  char consultingRoom[vitalia::COMMAND_CONSULTING_ROOM_BYTES + 1] = {};  // solo ShowTicket
};

/**
 * Solo modifica out cuando el JSON completo es válido: cada tipo con exactamente sus campos
 * (SHOW_TICKET: ticketCode + consultingRoom; ASSIGN/CLEAR_TICKET: ticketCode; RELEASE_WEARABLE:
 * ninguno). Un tipo desconocido se ignora.
 */
bool parseCommand(const char* payload, size_t length, Command& out);

/** Reensambla una publicación ESP-MQTT; un fragmento inválido descarta toda la recepción. */
class CommandInbox {
 public:
  bool configure(const char* filter);
  void reset();
  bool receive(const char* topic, size_t topicLength, const char* data, size_t length,
               size_t total, size_t offset, bool retained, Command& out);
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

/**
 * Estado de la pulsera en RAM: turno asignado y llamado activo. Se pierde al reiniciar; la API
 * lo reenvía cuando la pulsera vuelve a publicar después de un hueco (ADR 0021).
 */
class CallState {
 public:
  /**
   * Aplica un comando. Devuelve true si cambió lo que muestra el OLED (un SHOW_TICKET repetido
   * no reinicia el desplazamiento). CLEAR_TICKET de otro turno que el llamado se ignora.
   */
  bool apply(const Command& command, uint32_t now);
  /** Termina un llamado de más de maxMs: el CLEAR_TICKET pudo perderse sin conexión. */
  bool expire(uint32_t now, uint32_t maxMs);
  bool active() const { return active_; }
  const Command& command() const { return command_; }
  /** Código del turno asignado, "" si la pulsera está libre. */
  const char* assignedCode() const { return assigned_; }
  CallFrame frame(uint32_t now, bool connected, uint32_t scrollMs) const;
 private:
  Command command_;
  char assigned_[vitalia::COMMAND_TICKET_CODE_BYTES + 1] = {};
  uint32_t receivedAt_ = 0;
  bool active_ = false;
};

/** Pantalla del paciente cuando no hay llamado: sus signos en vivo, sin datos técnicos. */
struct HomeInput {
  const char* assignedCode = "";  // "" sin turno
  std::optional<uint16_t> hr;
  std::optional<uint8_t> spo2;
  std::optional<float> tempC;     // ya compensada; fuera de rango físico no se muestra
  bool fever = false;             // indicador local (FEVER_DISPLAY_THRESHOLD_C)
  bool connected = true;          // con el broker
  bool fallRecent = false;
};
struct HomeFrame {
  char header[DISPLAY_COLUMNS + 1] = {};
  char vitals[DISPLAY_COLUMNS + 1] = {};
  char temp[DISPLAY_COLUMNS + 1] = {};
};
/**
 *   Turno A-024   SIN RED     (o "Vitalia" sin turno; "SIN RED" solo sin broker)
 *   87 lpm  SpO2 99%          ("--" sin medición válida; "CAIDA DETECTADA" con una caída)
 *   Temp 36.6 C  FIEBRE
 */
HomeFrame homeFrame(const HomeInput& in);

}  // namespace commands
