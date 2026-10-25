import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PREFIX,
  type CallTicketRequest,
  type CheckInRequest,
  type ConsultingRoom,
  type PublicTicket,
  type ServiceArea,
  type Ticket,
  type TicketStatus,
  type TriageLevel,
  type UpdateTicketStatusRequest,
  type UpdateTriageRequest,
  type VitalsHistory,
} from '@vitalia/contracts';
import { type Observable, shareReplay } from 'rxjs';

const BASE = `/${API_PREFIX}`;

/** Turnos y consultorios (`/api/tickets`, `/api/consulting-rooms`). */
@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly http = inject(HttpClient);
  private rooms$?: Observable<ConsultingRoom[]>;
  private services$?: Observable<ServiceArea[]>;

  /** Turnos del día. Sin `statuses`, los abiertos (en espera, llamados y en atención). */
  list(statuses?: readonly TicketStatus[]): Observable<Ticket[]> {
    const params = statuses?.length ? { status: statuses.join(',') } : undefined;
    return this.http.get<Ticket[]>(`${BASE}/tickets`, { params });
  }

  call(id: string, consultingRoomId: string): Observable<Ticket> {
    const body: CallTicketRequest = { consultingRoomId };
    return this.http.post<Ticket>(`${BASE}/tickets/${id}/call`, body);
  }

  updateStatus(id: string, status: TicketStatus): Observable<Ticket> {
    const body: UpdateTicketStatusRequest = { status };
    return this.http.patch<Ticket>(`${BASE}/tickets/${id}/status`, body);
  }

  updateTriage(id: string, triageLevel: TriageLevel): Observable<Ticket> {
    const body: UpdateTriageRequest = { triageLevel };
    return this.http.patch<Ticket>(`${BASE}/tickets/${id}/triage`, body);
  }

  /** Check-in desde recepción (mismo endpoint que el portal, con `source: RECEPTION`). */
  checkIn(req: Omit<CheckInRequest, 'source'>): Observable<PublicTicket> {
    const body: CheckInRequest = { ...req, source: 'RECEPTION' };
    return this.http.post<PublicTicket>(`${BASE}/check-in`, body);
  }

  /** Curva de signos vitales del turno (`minutes` hacia atrás, agrupada por la API). */
  vitals(id: string, minutes: number): Observable<VitalsHistory> {
    return this.http.get<VitalsHistory>(`${BASE}/tickets/${id}/readings`, { params: { minutes } });
  }

  services(): Observable<ServiceArea[]> {
    this.services$ ??= this.http.get<ServiceArea[]>(`${BASE}/services`).pipe(shareReplay(1));
    return this.services$;
  }

  /** Consultorios activos (casi no cambian: se piden una vez por sesión de la app). */
  consultingRooms(): Observable<ConsultingRoom[]> {
    this.rooms$ ??= this.http.get<ConsultingRoom[]>(`${BASE}/consulting-rooms`).pipe(shareReplay(1));
    return this.rooms$;
  }
}
