import { computed, type DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  assessVitals,
  REALTIME_EVENTS,
  WEARABLE_ONLINE_WINDOW_MS,
  type CreateWearableRequest,
  type QueueUpdatedEvent,
  type TelemetryReadingEvent,
  type VitalsAssessment,
  type Wearable,
  type WearableLastReading,
} from '@vitalia/contracts';
import { catchError, debounceTime, EMPTY, filter, firstValueFrom, merge, map, switchMap } from 'rxjs';
import { apiErrorMessage } from '../api/api-error';
import { WearablesApi } from '../api/wearables.api';
import { RealtimeService } from '../realtime/realtime.service';
import { ClockService } from '../time/clock.service';

/** Una pulsera con su conexión recalculada en vivo y su evaluación clínica. */
export interface WearableView extends Wearable {
  assessment: VitalsAssessment | null;
}

/** Evalúa la última lectura con la misma regla que la API (`assessVitals` de contracts). */
export function assessLastReading(r: WearableLastReading | null): VitalsAssessment | null {
  if (!r) return null;
  return assessVitals({
    hr: r.hr ?? undefined,
    spo2: r.spo2 ?? undefined,
    temp: r.temp ?? undefined,
    accPeakG: r.accPeakG ?? undefined,
    fall: r.fall,
  });
}

/** Aplica una lectura en vivo (`telemetry:reading`) a la pulsera correspondiente. */
export function applyReading(list: Wearable[], e: TelemetryReadingEvent): Wearable[] {
  return list.map((w) => {
    if (w.code !== e.wearableId) return w;
    if (w.lastReading && w.lastReading.seq > e.reading.seq) return w; // llegó una vieja
    const r = e.reading;
    return {
      ...w,
      lastSeenAt: e.receivedAt,
      lastReading: {
        seq: r.seq,
        measuredAt: new Date(r.ts).toISOString(),
        hr: r.hr ?? null,
        spo2: r.spo2 ?? null,
        temp: r.temp ?? null,
        accPeakG: r.accPeakG ?? null,
        fall: r.fall ?? false,
        level: e.assessment.level,
      },
    };
  });
}

/**
 * Pulseras en vivo: lista de `GET /api/wearables` + cada `telemetry:reading`. Lo usan la
 * vista de pulseras y la fila de triaje (signos vitales por turno, `byTicket`).
 */
@Injectable({ providedIn: 'root' })
export class WearablesStore {
  private readonly api = inject(WearablesApi);
  private readonly realtime = inject(RealtimeService);
  private readonly clock = inject(ClockService);

  private readonly list = signal<Wearable[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly wearables = computed<WearableView[]>(() => {
    const now = this.clock.now();
    return this.list().map((w) => ({
      ...w,
      online: w.lastSeenAt !== null && now - new Date(w.lastSeenAt).getTime() <= WEARABLE_ONLINE_WINDOW_MS,
      assessment: assessLastReading(w.lastReading),
    }));
  });
  readonly byTicket = computed(
    () => new Map(this.wearables().flatMap((w) => (w.ticket ? [[w.ticket.id, w] as const] : []))),
  );
  readonly onlineCount = computed(() => this.wearables().filter((w) => w.online).length);

  start(destroyRef: DestroyRef): void {
    this.list.set([]);
    this.reload();

    this.realtime
      .on<TelemetryReadingEvent>(REALTIME_EVENTS.TELEMETRY_READING)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((e) => {
        const known = this.list().find((w) => w.code === e.wearableId);
        this.list.update((l) => applyReading(l, e));
        // La pulsera cambió de turno sin que nos enteráramos: recargar.
        if (!known || (known.ticket?.id ?? null) !== e.ticketId) this.reload();
      });

    merge(
      this.realtime.ready$,
      // Al finalizar o cancelar un turno, la API libera su pulsera.
      this.realtime
        .on<QueueUpdatedEvent>(REALTIME_EVENTS.QUEUE_UPDATED)
        .pipe(filter((e) => e.change === 'STATUS')),
    )
      .pipe(
        debounceTime(300),
        switchMap(() => this.api.list().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((l) => this.list.set(l));
  }

  reload(): void {
    this.loading.set(true);
    this.api
      .list()
      .pipe(
        map((l) => {
          this.loading.set(false);
          this.error.set(null);
          return l;
        }),
        catchError((err: unknown) => {
          this.loading.set(false);
          this.error.set(apiErrorMessage(err, 'No se pudieron cargar las pulseras'));
          return EMPTY;
        }),
      )
      .subscribe((l) => this.list.set(l));
  }

  async create(req: CreateWearableRequest): Promise<Wearable> {
    return this.upsert(await firstValueFrom(this.api.create(req)));
  }

  async assign(w: Wearable, ticketId: string): Promise<Wearable> {
    return this.upsert(await firstValueFrom(this.api.assign(w.id, ticketId)));
  }

  async release(w: Wearable): Promise<Wearable> {
    return this.upsert(await firstValueFrom(this.api.release(w.id)));
  }

  private upsert(w: Wearable): Wearable {
    this.list.update((l) =>
      [...l.filter((x) => x.id !== w.id), w].sort((a, b) => a.code.localeCompare(b.code)),
    );
    return w;
  }
}
