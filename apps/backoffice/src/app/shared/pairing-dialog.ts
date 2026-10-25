import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { LucideSmartphone } from '@lucide/angular';
import type { PairingCode } from '@vitalia/contracts';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../core/api/api-error';
import { TicketsApi } from '../core/api/tickets.api';

export interface PairingDialogData {
  ticketId: string;
  ticketCode: string;
}

/** `K7M2QX` → `K7M 2QX`: se dicta y se lee en dos partes. */
export function formatPairingCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** `mm:ss` que faltan hasta `expiresAt` (0:00 si ya venció). */
export function remaining(expiresAt: string, now: number): string {
  const s = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Código de un solo uso (10 min) para que el paciente vincule la app Vitalia a un turno que
 * se sacó por el portal o en recepción (ADR 0019). El código se genera al abrir.
 */
@Component({
  selector: 'vt-pairing-dialog',
  imports: [MatDialogModule, MatButtonModule, LucideSmartphone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Vincular la app del paciente</h2>
    <mat-dialog-content>
      <p class="lead">
        En la app Vitalia: <strong>Ya tengo turno</strong> → escribir este código para el turno
        <strong>{{ data.ticketCode }}</strong
        >.
      </p>
      @if (pairing(); as p) {
        <div class="code" [class.expired]="expired()" role="status" aria-live="polite">
          <svg lucideSmartphone [size]="22" aria-hidden="true"></svg>
          <span class="digits" [attr.aria-label]="'Código ' + p.code.split('').join(' ')">{{
            format(p.code)
          }}</span>
        </div>
        <p class="ttl">
          @if (expired()) {
            El código venció. Generá otro.
          } @else {
            Vence en {{ left() }} · sirve una sola vez
          }
        </p>
      } @else if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else {
        <p class="ttl">Generando código…</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="generate()" [disabled]="loading()">Generar otro</button>
      <button mat-flat-button type="button" mat-dialog-close>Listo</button>
    </mat-dialog-actions>
  `,
  styles: `
    .lead {
      margin: 0 0 16px;
      color: var(--vt-muted);
    }
    .code {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 22px 16px;
      border-radius: var(--vt-r-md);
      background: var(--vt-surface-2);
      color: var(--vt-primary);
      &.expired {
        opacity: 0.4;
      }
    }
    .digits {
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      font-size: 44px;
      font-weight: 800;
      letter-spacing: 0.12em;
    }
    .ttl {
      margin: 12px 0 0;
      text-align: center;
      font-size: 13px;
      color: var(--vt-muted);
      font-variant-numeric: tabular-nums;
    }
    .error {
      color: var(--vt-danger);
    }
  `,
})
export class PairingDialog {
  protected readonly data = inject<PairingDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(TicketsApi);

  protected readonly pairing = signal<PairingCode | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  private readonly now = signal(Date.now());
  protected readonly left = computed(() => {
    const p = this.pairing();
    return p ? remaining(p.expiresAt, this.now()) : '';
  });
  protected readonly expired = computed(() => this.left() === '0:00');
  protected readonly format = formatPairingCode;

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
    void this.generate();
  }

  protected async generate(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.pairing.set(await firstValueFrom(this.api.pairing(this.data.ticketId)));
      this.now.set(Date.now());
    } catch (err) {
      this.pairing.set(null);
      this.error.set(apiErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}
