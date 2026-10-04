# 0007. Socket.IO para tiempo real

- Estado: Aceptado
- Fecha: 2026-10-03

## Contexto

La tesis (§9.3) indica WebSockets con Socket.IO para los eventos `ticket:called` y `alert:emergency` hacia el Backoffice, la TV y el paciente.

## Decisión

`@nestjs/websockets` + `@nestjs/platform-socket.io` en la API y `socket.io-client` en los frontends. Salas `staff`, `tv` y `patient:<ticketId>`. Nombres de eventos en `@vitalia/contracts`.

## Consecuencias

- (+) Reconexión automática, salas y fallback de transporte. Integración nativa con Nest.
- (−) Protocolo propio (no WebSocket puro). El portal React también necesita `socket.io-client`.
