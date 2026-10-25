import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { LucideVolume2, LucideWifi, LucideWifiOff } from '@lucide/angular';
import { API_PREFIX, type RecentCallsResponse, type ServiceArea } from '@vitalia/contracts';
import { Logo } from '@vitalia/ui';
import { catchError, EMPTY, filter, map, of, startWith, switchMap } from 'rxjs';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AnnouncerService } from '../../core/sound/announcer.service';
import { applyCall, type CallBoard, EMPTY_BOARD, fromRecent } from './call-board';

const BOARD_KEY = 'vitalia_tv_board';

/** `?servicio=GUARDIA`: la TV de una sala muestra solo los llamados de ese servicio. */
export function serviceFromUrl(search: string): string | null {
  const v = new URLSearchParams(search).get('servicio')?.trim().toUpperCase();
  return v || null;
}
/** Cuánto dura el destello del llamado nuevo. */
const HIGHLIGHT_MS = 8000;

function readBoard(key: string): CallBoard {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CallBoard) : EMPTY_BOARD;
  } catch {
    return EMPTY_BOARD;
  }
}

/**
 * Llamador de la sala de espera (VLAN 40, kiosco). Muestra el llamado actual y los últimos,
 * los anuncia con campanita y voz, y si se corta la conexión sigue mostrando el último estado
 * (también guardado en el navegador por si se recarga la página).
 */
@Component({
  selector: 'vt-display',
  imports: [Logo, LucideWifi, LucideWifiOff, LucideVolume2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './display.html',
  styleUrl: './display.scss',
})
export class Display {
  protected readonly realtime = inject(RealtimeService);
  protected readonly announcer = inject(AnnouncerService);
  private readonly http = inject(HttpClient);

  /** Servicio filtrado (o null = todos). Cada servicio guarda su propio tablero. */
  protected readonly service = serviceFromUrl(inject(DOCUMENT).location?.search ?? '');
  private readonly boardKey = this.service ? `${BOARD_KEY}:${this.service}` : BOARD_KEY;
  protected readonly serviceName = toSignal(
    this.service
      ? this.http.get<ServiceArea[]>(`/${API_PREFIX}/services`).pipe(
          map((list) => list.find((s) => s.code === this.service)?.name ?? this.service),
          catchError(() => of(this.service)),
        )
      : of(null),
  );

  protected readonly now = signal(new Date());
  protected readonly board = signal<CallBoard>(readBoard(this.boardKey));
  protected readonly highlight = signal(false);
  private highlightTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const id = setInterval(() => this.now.set(new Date()), 1000);
    destroyRef.onDestroy(() => {
      clearInterval(id);
      clearTimeout(this.highlightTimer);
    });

    // Al arrancar y en cada reconexión, ponerse al día con lo que se llamó mientras tanto.
    this.realtime.ready$
      .pipe(
        startWith(undefined),
        switchMap(() =>
          this.http
            .get<RecentCallsResponse>(`/${API_PREFIX}/tickets/recent-calls`, {
              params: this.service ? { serviceCode: this.service } : {},
            })
            .pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((list) => this.board.set(fromRecent(list)));

    this.realtime.ticketCalled$
      .pipe(
        filter((e) => !this.service || e.serviceCode === this.service),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((e) => {
        this.board.update((b) => applyCall(b, e));
        this.announcer.announce(e);
        this.flash();
      });

    effect(() => {
      const b = this.board();
      try {
        localStorage.setItem(this.boardKey, JSON.stringify(b));
      } catch {
        /* sin storage */
      }
    });
  }

  protected time(d: Date): string {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  protected date(d: Date): string {
    const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected calledAt(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private flash(): void {
    // Reiniciar la animación aunque llegue otro llamado durante el destello.
    this.highlight.set(false);
    clearTimeout(this.highlightTimer);
    requestAnimationFrame(() => this.highlight.set(true));
    this.highlightTimer = setTimeout(() => this.highlight.set(false), HIGHLIGHT_MS);
  }
}
