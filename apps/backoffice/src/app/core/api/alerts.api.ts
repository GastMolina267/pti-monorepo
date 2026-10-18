import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_PREFIX, type Alert } from '@vitalia/contracts';
import type { Observable } from 'rxjs';

const BASE = `/${API_PREFIX}/alerts`;

/** Alertas clínicas (`/api/alerts`). */
@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly http = inject(HttpClient);

  /** `active = true`: solo las activas; `false`: las últimas 100 de cualquier estado. */
  list(active = true): Observable<Alert[]> {
    return this.http.get<Alert[]>(BASE, { params: { active: String(active) } });
  }

  acknowledge(id: string): Observable<Alert> {
    return this.http.post<Alert>(`${BASE}/${id}/ack`, {});
  }
}
