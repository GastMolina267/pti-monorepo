import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PREFIX,
  type AssignWearableRequest,
  type CreateWearableRequest,
  type UpdateWearableRequest,
  type Wearable,
} from '@vitalia/contracts';
import type { Observable } from 'rxjs';

const BASE = `/${API_PREFIX}/wearables`;

/** Pulseras IoMT (`/api/wearables`). */
@Injectable({ providedIn: 'root' })
export class WearablesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Wearable[]> {
    return this.http.get<Wearable[]>(BASE);
  }

  create(req: CreateWearableRequest): Observable<Wearable> {
    return this.http.post<Wearable>(BASE, req);
  }

  update(id: string, req: UpdateWearableRequest): Observable<Wearable> {
    return this.http.patch<Wearable>(`${BASE}/${id}`, req);
  }

  assign(id: string, ticketId: string): Observable<Wearable> {
    const body: AssignWearableRequest = { ticketId };
    return this.http.post<Wearable>(`${BASE}/${id}/assign`, body);
  }

  release(id: string): Observable<Wearable> {
    return this.http.post<Wearable>(`${BASE}/${id}/release`, {});
  }
}
