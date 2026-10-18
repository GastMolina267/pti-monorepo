import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { REALTIME_EVENTS, type Alert, type AlertEmergencyEvent } from '@vitalia/contracts';
import { Subject } from 'rxjs';
import { RealtimeService } from '../realtime/realtime.service';
import { AlarmService } from '../sound/alarm.service';
import { alertFromEvent, AlertsStore, mergeAlerts } from './alerts.store';
import { QueueStore } from './queue.store';

const EVENT: AlertEmergencyEvent = {
  alertId: 'a1',
  wearableId: 'wb-03-5e0003',
  ticketId: 't1',
  ticketCode: 'B-003',
  kind: 'FALL',
  level: 'CRITICAL',
  message: 'Caída detectada',
  detectedAt: new Date().toISOString(),
};

describe('alertFromEvent / mergeAlerts', () => {
  it('arma la alerta desde el evento y ordena sin duplicar', () => {
    const a = alertFromEvent(EVENT, 'Agustina A.');
    expect(a).toMatchObject({
      id: 'a1',
      status: 'ACTIVE',
      ticketCode: 'B-003',
      patientDisplayName: 'Agustina A.',
    });
    const older = { ...a, id: 'a0', detectedAt: '2026-01-01T00:00:00.000Z' };
    expect(mergeAlerts([older], [a, a]).map((x) => x.id)).toEqual(['a1', 'a0']);
  });
});

describe('AlertsStore', () => {
  function setup() {
    const events = new Map<string, Subject<unknown>>();
    const realtime = {
      ready$: new Subject<void>(),
      on: (e: string) => {
        if (!events.has(e)) events.set(e, new Subject());
        return (events.get(e) as Subject<unknown>).asObservable();
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: realtime },
        {
          provide: QueueStore,
          useValue: { tickets: () => [{ id: 't1', patient: { displayName: 'Agustina A.' } }] },
        },
      ],
    });
    const store = TestBed.inject(AlertsStore);
    const alarm = TestBed.inject(AlarmService);
    const http = TestBed.inject(HttpTestingController);
    store.start(TestBed.inject(DestroyRef));
    http.expectOne('/api/alerts?active=true').flush([] as Alert[]);
    const fire = (e: string, payload: unknown) => events.get(e)?.next(payload);
    return { store, alarm, http, fire, ready: () => realtime.ready$.next() };
  }

  it('suma la alerta en vivo, enciende la alarma y la saca al reconocerla en otro puesto', () => {
    const { store, alarm, fire } = setup();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    expect(store.active()[0]).toMatchObject({ id: 'a1', patientDisplayName: 'Agustina A.' });
    TestBed.tick();
    expect(alarm.active()).toBe(true);

    fire(REALTIME_EVENTS.ALERT_ACKNOWLEDGED, { alertId: 'a1', by: { id: 'u', fullName: 'X' }, at: '' });
    expect(store.count()).toBe(0);
    TestBed.tick();
    expect(alarm.active()).toBe(false);
  });

  it('minimizar silencia y oculta, pero una alerta nueva vuelve a sonar', () => {
    const { store, fire } = setup();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    store.minimizeAll();
    expect(store.pending()).toHaveLength(0);
    expect(store.count()).toBe(1);
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, { ...EVENT, alertId: 'a2', kind: 'HYPOXIA' });
    expect(store.pending().map((a) => a.id)).toEqual(['a2']);
  });

  it('al reconectar descarta una alerta conocida que otro puesto reconoció durante el corte', () => {
    const { store, http, fire, ready } = setup();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    ready();
    http.expectOne('/api/alerts?active=true').flush([]);
    expect(store.count()).toBe(0);
  });

  it('conserva una alerta emitida después de iniciar la consulta, antes de su persistencia', () => {
    const { store, http, fire } = setup();
    store.reload();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    http.expectOne('/api/alerts?active=true').flush([]);
    expect(store.active().map((a) => a.id)).toEqual(['a1']);
  });

  it('una respuesta en vuelo no reactiva una alerta ya reconocida por un evento', () => {
    const { store, http, fire } = setup();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    store.reload();
    fire(REALTIME_EVENTS.ALERT_ACKNOWLEDGED, { alertId: 'a1', by: { id: 'u', fullName: 'X' }, at: '' });
    http.expectOne('/api/alerts?active=true').flush([alertFromEvent(EVENT, null)]);
    expect(store.count()).toBe(0);
  });

  it('ignora respuestas antiguas que llegan después de una consulta más reciente', () => {
    const { store, http } = setup();
    store.reload();
    const older = http.expectOne('/api/alerts?active=true');
    store.reload();
    http.expectOne('/api/alerts?active=true').flush([]);
    older.flush([alertFromEvent(EVENT, null)]);
    expect(store.count()).toBe(0);
  });

  it('reconocer: POST /ack y la saca; un 409 (ya reconocida) también la saca', async () => {
    const { store, http, fire } = setup();
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, EVENT);
    fire(REALTIME_EVENTS.ALERT_EMERGENCY, { ...EVENT, alertId: 'a2' });

    const ok = store.acknowledge(store.active().find((a) => a.id === 'a1') as Alert);
    http.expectOne('/api/alerts/a1/ack').flush({});
    await ok;
    const conflict = store.acknowledge(store.active()[0]);
    http
      .expectOne('/api/alerts/a2/ack')
      .flush({ message: 'La alerta ya fue reconocida' }, { status: 409, statusText: 'Conflict' });
    await conflict;
    expect(store.count()).toBe(0);
  });
});
