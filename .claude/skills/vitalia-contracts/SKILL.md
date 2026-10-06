---
name: vitalia-contracts
description: Agregar o modificar contratos compartidos en libs/shared/contracts (@vitalia/contracts) - tipos de la API REST, eventos WebSocket, tópicos y payloads MQTT, constantes y reglas clínicas puras. Usala SIEMPRE que un tipo, evento, tópico o regla se use en más de un proyecto (API y Backoffice/TV/portal/firmware), o cuando cambie la forma de un request/response.
---

# Contratos compartidos (@vitalia/contracts)

## Principio

**Contrato primero:** se define en `libs/shared/contracts`, después se implementa en la API y se consume en los frontends. Así los dos lados no se desincronizan.

## Dónde va cada cosa

| Tipo de contrato | Carpeta | Ejemplo existente |
| --- | --- | --- |
| Request/response REST | `src/lib/api/` | `health.ts` → `HealthResponse` |
| Eventos Socket.IO | `src/lib/realtime/` | `events.ts` → `REALTIME_EVENTS`, `TicketCalledEvent` |
| MQTT (tópicos, payloads, sobre cifrado) | `src/lib/telemetry/` | `mqtt.ts` → `MQTT_TOPICS`, `TelemetryReading` |
| Reglas clínicas puras | `src/lib/clinical/` | `triage.ts` → `assessVitals()` |
| Nuevo dominio (ej. turnos) | `src/lib/<dominio>/` | `tickets/ticket.ts` |

## Pasos

1. Creá o editá el archivo en la carpeta del dominio. **Solo TS puro**: sin imports de Angular, Nest, RxJS ni Node.
2. Seguí las convenciones:
   - Interfaces para formas de datos (`interface TicketDto { ... }`). Fechas como `string` ISO-8601 (viajan por JSON).
   - Enumeraciones como `const` + tipo derivado, no `enum`:
     ```ts
     export const TICKET_STATUSES = ['WAITING', 'CALLED', 'IN_PROGRESS', 'DONE', 'NO_SHOW'] as const;
     export type TicketStatus = (typeof TICKET_STATUSES)[number];
     ```
   - Eventos: agregalos a `REALTIME_EVENTS` (`'<dominio>:<acción>'`) con su interfaz `XxxEvent`.
   - Requests de escritura: `CreateXxxRequest` y `UpdateXxxRequest`. Respuestas: `XxxResponse` o `Xxx`.
   - JSDoc en español sobre cada campo que no sea obvio (unidades: BPM, %, °C, g, ms).
3. Exportalo en el `index.ts` de la carpeta (y la carpeta en `src/index.ts` si es nueva).
4. Si agregaste lógica (funciones), sumá `*.spec.ts` con vitest al lado.
5. **Implementá en la API:** el DTO de clase hace `implements` de la interfaz y le agrega `class-validator` y `@ApiProperty` (ver `apps/api/src/modules/health/health.dto.ts`).
6. **Consumí en el front:** tipá `httpResource<Xxx>()` y los handlers de socket con la interfaz.
7. Actualizá `docs/04-contratos.md` (tabla del endpoint, evento o tópico).
8. Verificá: `pnpm nx affected -t lint test build`.

## Cambios que rompen

Renombrar o quitar campos, cambiar unidades o el formato de un tópico rompe a otros consumidores: el **portal cautivo** (repo aparte) y el **firmware** del wearable (`apps/wearable-firmware-poc`, C++: no importa los tipos, los replica a mano). Avisá en el PR, actualizá la doc y, si es MQTT, actualizá también el §6 de `apps/wearable-firmware-poc/AGENTS.md` y coordiná con hardware (Facundo). La CI recompila el firmware cuando cambia `contracts`.
