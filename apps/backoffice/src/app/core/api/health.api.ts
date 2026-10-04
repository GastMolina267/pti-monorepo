import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_PREFIX, HealthResponse } from '@vitalia/contracts';

/** Acceso al endpoint de salud del Edge Gateway (`GET /api/health`). */
@Injectable({ providedIn: 'root' })
export class HealthApi {
  /** Recurso reactivo: `value()`, `isLoading()`, `error()`, `reload()`. */
  readonly health = httpResource<HealthResponse>(() => `/${API_PREFIX}/health`);
}
