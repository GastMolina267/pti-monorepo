import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LucideMegaphone } from '@lucide/angular';
import type { ConsultingRoom, Ticket } from '@vitalia/contracts';
import { catchError, of } from 'rxjs';
import { apiErrorMessage } from '../core/api/api-error';
import { TicketsApi } from '../core/api/tickets.api';
import { QueueStore } from '../core/live/queue.store';

const LAST_ROOM_KEY = 'vitalia_last_room';

function readLastRoom(): string | null {
  try {
    return localStorage.getItem(LAST_ROOM_KEY);
  } catch {
    return null;
  }
}

/** Elegir consultorio y llamar el turno (TV, portal del paciente y OLED de la pulsera). */
@Component({
  selector: 'vt-call-dialog',
  imports: [MatDialogModule, MatButtonModule, MatProgressBarModule, LucideMegaphone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isRecall ? 'Volver a llamar' : 'Llamar' }} {{ ticket.code }}</h2>
    <mat-dialog-content>
      <p class="who">{{ ticket.patient.displayName }} · {{ ticket.service.name }}</p>
      @if (rooms() === undefined) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (rooms()?.length === 0) {
        <p class="error">No hay consultorios activos.</p>
      } @else {
        <div class="rooms" role="radiogroup" aria-label="Consultorio">
          @for (r of rooms(); track r.id) {
            <button
              type="button"
              class="room"
              role="radio"
              [attr.aria-checked]="selected() === r.id"
              [class.selected]="selected() === r.id"
              (click)="selected.set(r.id)"
            >
              <strong>{{ r.name }}</strong>
              @if (r.specialty) {
                <small>{{ r.specialty }}</small>
              }
            </button>
          }
        </div>
      }
      @if (error(); as msg) {
        <p class="error" role="alert">{{ msg }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="button" [disabled]="!selectedRoom() || calling()" (click)="call()">
        <svg lucideMegaphone [size]="16"></svg>
        {{ calling() ? 'Llamando…' : 'Llamar a ' + (selectedRoom()?.name ?? '…') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .who {
      margin: 0 0 14px;
      color: var(--vt-muted);
      font-weight: 600;
    }
    .rooms {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .room {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 12px 14px;
      border-radius: var(--vt-r-sm);
      border: 1px solid var(--vt-stroke-2);
      background: var(--vt-paper);
      color: var(--vt-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
      strong {
        font-weight: 800;
      }
      small {
        color: var(--vt-muted);
        font-size: 12px;
      }
      &.selected {
        border-color: var(--vt-primary);
        box-shadow: inset 0 0 0 1px var(--vt-primary);
        background: var(--vt-surface-2);
      }
      &:focus-visible {
        outline: 2px solid var(--vt-primary);
        outline-offset: 2px;
      }
    }
    .error {
      margin: 12px 0 0;
      color: var(--vt-danger);
      font-weight: 600;
    }
    button svg {
      margin-right: 6px;
    }
  `,
})
export class CallDialog {
  private readonly ref = inject(MatDialogRef<CallDialog, Ticket>);
  private readonly queue = inject(QueueStore);
  protected readonly ticket = inject<Ticket>(MAT_DIALOG_DATA);
  protected readonly isRecall = this.ticket.status === 'CALLED';

  protected readonly rooms = toSignal(
    inject(TicketsApi)
      .consultingRooms()
      .pipe(catchError(() => of([] as ConsultingRoom[]))),
  );
  protected readonly selected = signal<string | null>(this.ticket.consultingRoom?.id ?? readLastRoom());
  protected readonly selectedRoom = computed(
    () => this.rooms()?.find((r) => r.id === this.selected()) ?? null,
  );
  protected readonly calling = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async call(): Promise<void> {
    const room = this.selectedRoom();
    if (!room) return;
    this.calling.set(true);
    this.error.set(null);
    try {
      const ticket = await this.queue.call(this.ticket, room.id);
      try {
        localStorage.setItem(LAST_ROOM_KEY, room.id);
      } catch {
        /* sin storage */
      }
      this.ref.close(ticket);
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo llamar el turno'));
      this.calling.set(false);
    }
  }
}
