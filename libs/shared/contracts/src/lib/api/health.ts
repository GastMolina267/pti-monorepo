/** Estado de salud de un servicio del Edge Gateway (`GET /api/health`). */
export type ServiceStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheck {
  /** Nombre del componente verificado (ej. `database`, `mqtt`). */
  name: string;
  status: ServiceStatus;
  /** Detalle opcional legible (ej. mensaje de error). */
  detail?: string;
}

export interface HealthResponse {
  status: ServiceStatus;
  service: 'vitalia-api';
  version: string;
  environment: string;
  /** Segundos desde que arrancó el proceso. */
  uptimeSeconds: number;
  /** ISO-8601 */
  timestamp: string;
  checks: HealthCheck[];
}
