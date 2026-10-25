/**
 * Réplica hacia la nube (RF-O6, capa Cloud). El gateway guarda cada cambio en un outbox local
 * y lo envía por lotes cuando hay WAN; si no hay, espera y reintenta sin perder nada.
 * Solo viajan turnos y alertas con datos minimizados (sin DNI); la telemetría cruda no sale.
 */
export const SYNC_TOPICS = ['ticket.upsert', 'alert.upsert'] as const;
export type SyncTopic = (typeof SYNC_TOPICS)[number];

/** Un cambio del outbox. `id` es creciente por gateway: la nube deduplica por `(gatewayId, id)`. */
export interface SyncEnvelope<T = unknown> {
  id: number;
  topic: SyncTopic;
  entityId: string;
  /** ISO-8601, cuándo pasó el cambio en el gateway. */
  occurredAt: string;
  /** `Ticket` o `Alert` de `@vitalia/contracts`. */
  payload: T;
}

/** `POST <CLOUD_SYNC_URL>` con `Authorization: Bearer <CLOUD_SYNC_TOKEN>`. Respuesta 2xx = recibido. */
export interface SyncBatch {
  gatewayId: string;
  sentAt: string;
  events: SyncEnvelope[];
}

/** `GET /api/sync/status` (ADMIN). */
export interface SyncStatus {
  enabled: boolean;
  gatewayId: string;
  /** Cambios guardados que todavía no llegaron a la nube. */
  pending: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  /** ISO-8601 del próximo intento. */
  nextAttemptAt: string | null;
}

/** Máximo de eventos por lote. */
export const SYNC_BATCH_SIZE = 100;
