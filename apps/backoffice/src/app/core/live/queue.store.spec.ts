import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REALTIME_EVENTS, type Ticket } from '@vitalia/contracts';
import { Subject } from 'rxjs';
import { RealtimeService } from '../realtime/realtime.service';
import { QueueStore } from './queue.store';

const ticket = (id: string, patch: Partial<Ticket> = {}): Ticket => ({
  id,
  code: id.toUpperCase(),
  status: 'WAITING',
  triageLevel: 'STABLE',
  source: 'KIOSK',
  service: { id: 's', code: 'CLINICA', name: 'Clínica Médica', prefix: 'A' },
  patient: { id: `p-${id}`, displayName: 'Paciente' },
  checkedInAt: '2026-10-18T12:00:00.000Z',
  ...patch,
});

describe('QueueStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const queueUpdated = new Subject<unknown>();
    const realtime = {
      ready$: new Subject<void>(),
      on: (e: string) => (e === REALTIME_EVENTS.QUEUE_UPDATED ? queueUpdated : new Subject()).asObservable(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: realtime },
      ],
    });
    const store = TestBed.inject(QueueStore);
    const http = TestBed.inject(HttpTestingController);
    store.start(TestBed.inject(DestroyRef));
    return { store, http, queueUpdated };
  }

  it('ordena la fila por triaje y llegada, y separa llamados', () => {
    const { store, http } = setup();
    http
      .expectOne('/api/tickets')
      .flush([
        ticket('a1', { checkedInAt: '2026-10-18T11:00:00.000Z' }),
        ticket('a2', { triageLevel: 'CRITICAL' }),
        ticket('a3', { status: 'CALLED', calledAt: '2026-10-18T12:30:00.000Z' }),
      ]);
    expect(store.waiting().map((t) => t.id)).toEqual(['a2', 'a1']);
    expect(store.inCare().map((t) => t.id)).toEqual(['a3']);
    expect(store.criticalCount()).toBe(1);
  });

  it('recarga ante queue:updated (varios avisos seguidos = un pedido)', () => {
    const { store, http, queueUpdated } = setup();
    http.expectOne('/api/tickets').flush([ticket('a1')]);
    queueUpdated.next({});
    queueUpdated.next({});
    vi.advanceTimersByTime(300);
    http.expectOne('/api/tickets').flush([ticket('a1'), ticket('a2')]);
    http.verify();
    expect(store.tickets()).toHaveLength(2);
  });

  it('aplica la respuesta de una acción: un turno finalizado sale de la fila', async () => {
    const { store, http } = setup();
    http.expectOne('/api/tickets').flush([ticket('a1', { status: 'IN_PROGRESS' })]);
    const done = store.setStatus(store.tickets()[0], 'DONE');
    const req = http.expectOne('/api/tickets/a1/status');
    expect(req.request.body).toEqual({ status: 'DONE' });
    req.flush(ticket('a1', { status: 'DONE' }));
    await done;
    expect(store.tickets()).toHaveLength(0);
  });
});
