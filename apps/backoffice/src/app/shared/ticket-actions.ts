import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideEllipsisVertical, LucideMegaphone } from '@lucide/angular';
import {
  canTransition,
  ROLES_CAN_CALL,
  ROLES_CAN_TRIAGE,
  TRIAGE_LEVEL_LABELS,
  TRIAGE_LEVELS,
  type Ticket,
  type TicketStatus,
  type TriageLevel,
} from '@vitalia/contracts';
import { apiErrorMessage } from '../core/api/api-error';
import { AuthService } from '../core/auth/auth.service';
import { QueueStore } from '../core/live/queue.store';
import { CallDialog } from './call-dialog';

interface StatusAction {
  status: TicketStatus;
  label: string;
  /** Mensaje del snackbar al terminar. */
  done: string;
}

const STATUS_ACTIONS: StatusAction[] = [
  { status: 'IN_PROGRESS', label: 'Pasar a atención', done: 'en atención' },
  { status: 'DONE', label: 'Finalizar atención', done: 'finalizado' },
  { status: 'WAITING', label: 'Devolver a la fila', done: 'de vuelta en la fila' },
  { status: 'NO_SHOW', label: 'Marcar ausente', done: 'marcado ausente' },
  { status: 'CANCELLED', label: 'Cancelar turno', done: 'cancelado' },
];

/** Acción principal según el estado del turno. */
const PRIMARY: Partial<Record<TicketStatus, TicketStatus>> = { CALLED: 'IN_PROGRESS', IN_PROGRESS: 'DONE' };

/**
 * Acciones de un turno con las reglas de contracts: transiciones (`canTransition`) y roles
 * (`ROLES_CAN_CALL`, `ROLES_CAN_TRIAGE`). La acción principal va como botón; el resto, en el menú.
 */
@Component({
  selector: 'vt-ticket-actions',
  imports: [MatButtonModule, MatMenuModule, LucideEllipsisVertical, LucideMegaphone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (primary(); as p) {
      <button mat-flat-button type="button" class="primary" [disabled]="busy()" (click)="run(p)">
        {{ p.label }}
      </button>
    } @else if (canCall() && ticket().status === 'WAITING') {
      <button mat-flat-button type="button" class="primary" [disabled]="busy()" (click)="openCall()">
        <svg lucideMegaphone [size]="16"></svg>
        Llamar
      </button>
    }
    @if (hasMenu()) {
      <button
        type="button"
        class="more"
        [matMenuTriggerFor]="menu"
        [disabled]="busy()"
        [attr.aria-label]="'Más acciones para ' + ticket().code"
      >
        <svg lucideEllipsisVertical [size]="18"></svg>
      </button>
      <mat-menu #menu="matMenu" xPosition="before">
        @if (canCall() && ticket().status === 'CALLED') {
          <button mat-menu-item (click)="openCall()">Volver a llamar</button>
        }
        @for (a of secondary(); track a.status) {
          <button mat-menu-item (click)="run(a)">{{ a.label }}</button>
        }
        @if (triageOptions().length) {
          <div class="menu-label">Triaje manual</div>
          @for (l of triageOptions(); track l) {
            <button mat-menu-item (click)="setTriage(l)">Marcar {{ levelLabels[l].toLowerCase() }}</button>
          }
        }
      </mat-menu>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .primary {
      border-radius: 999px;
      white-space: nowrap;
      svg {
        margin-right: 6px;
      }
    }
    .more {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 1px solid transparent;
      background: transparent;
      color: var(--vt-muted);
      cursor: pointer;
      &:hover {
        border-color: var(--vt-stroke-2);
        color: var(--vt-ink);
      }
      &:focus-visible {
        outline: 2px solid var(--vt-primary);
      }
    }
    .menu-label {
      padding: 8px 16px 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vt-muted-2);
      border-top: 1px solid var(--vt-divider);
    }
  `,
})
export class TicketActions {
  readonly ticket = input.required<Ticket>();

  private readonly auth = inject(AuthService);
  private readonly queue = inject(QueueStore);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly levelLabels = TRIAGE_LEVEL_LABELS;
  protected readonly busy = signal(false);
  protected readonly canCall = computed(() => this.auth.can(ROLES_CAN_CALL));

  protected readonly primary = computed(() => {
    const next = PRIMARY[this.ticket().status];
    return next ? (STATUS_ACTIONS.find((a) => a.status === next) ?? null) : null;
  });
  protected readonly secondary = computed(() => {
    const t = this.ticket();
    const primary = this.primary()?.status;
    return STATUS_ACTIONS.filter((a) => a.status !== primary && canTransition(t.status, a.status));
  });
  protected readonly triageOptions = computed<TriageLevel[]>(() => {
    const t = this.ticket();
    const open = t.status === 'WAITING' || t.status === 'CALLED' || t.status === 'IN_PROGRESS';
    return open && this.auth.can(ROLES_CAN_TRIAGE) ? TRIAGE_LEVELS.filter((l) => l !== t.triageLevel) : [];
  });
  protected readonly hasMenu = computed(
    () =>
      this.secondary().length > 0 ||
      this.triageOptions().length > 0 ||
      (this.canCall() && this.ticket().status === 'CALLED'),
  );

  protected openCall(): void {
    this.dialog
      .open<CallDialog, Ticket, Ticket>(CallDialog, { data: this.ticket(), width: '520px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe((t) => {
        if (t)
          this.snack.open(`${t.code} llamado a ${t.consultingRoom?.name ?? 'consultorio'}`, 'OK', {
            duration: 3500,
          });
      });
  }

  protected async run(a: StatusAction): Promise<void> {
    await this.exec(async () => {
      const t = await this.queue.setStatus(this.ticket(), a.status);
      return `${t.code} ${a.done}`;
    });
  }

  protected async setTriage(level: TriageLevel): Promise<void> {
    await this.exec(async () => {
      const t = await this.queue.setTriage(this.ticket(), level);
      return `${t.code}: triaje ${TRIAGE_LEVEL_LABELS[level].toLowerCase()}`;
    });
  }

  private async exec(action: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    try {
      this.snack.open(await action(), 'OK', { duration: 3000 });
    } catch (err) {
      this.snack.open(apiErrorMessage(err), 'Cerrar', { duration: 5000 });
    } finally {
      this.busy.set(false);
    }
  }
}
