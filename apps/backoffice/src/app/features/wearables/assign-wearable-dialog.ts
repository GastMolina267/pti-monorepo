import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TICKET_STATUS_LABELS, type Ticket, type Wearable } from '@vitalia/contracts';
import { apiErrorMessage } from '../../core/api/api-error';
import { QueueStore } from '../../core/live/queue.store';
import { WearablesStore } from '../../core/live/wearables.store';
import { LevelPill } from '../../shared/level-pill';

/** Turnos abiertos que todavía no tienen pulsera, en el orden de la fila. */
export function assignableTickets(tickets: Ticket[], withWearable: ReadonlySet<string>): Ticket[] {
  return tickets.filter((t) => !withWearable.has(t.id));
}

/** Entregar la pulsera a un paciente con turno abierto. */
@Component({
  selector: 'vt-assign-wearable-dialog',
  imports: [MatDialogModule, MatButtonModule, LevelPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Asignar pulsera N° {{ pad(wearable.number) }}</h2>
    <mat-dialog-content>
      <input
        class="search"
        type="search"
        placeholder="Buscar turno o paciente"
        aria-label="Buscar turno o paciente"
        (input)="text.set($any($event.target).value)"
      />
      <ul class="list" role="listbox" aria-label="Turnos sin pulsera">
        @for (t of options(); track t.id) {
          <li>
            <button
              type="button"
              role="option"
              [attr.aria-selected]="selected() === t.id"
              [class.selected]="selected() === t.id"
              (click)="selected.set(t.id)"
            >
              <strong>{{ t.code }}</strong>
              <span>{{ t.patient.displayName }} · {{ t.service.name }} · {{ statusLabels[t.status] }}</span>
              <vt-level-pill [level]="t.triageLevel" />
            </button>
          </li>
        } @empty {
          <li class="empty">No hay turnos abiertos sin pulsera.</li>
        }
      </ul>
      @if (error(); as msg) {
        <p class="error" role="alert">{{ msg }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancelar</button>
      <button mat-flat-button type="button" [disabled]="!selected() || saving()" (click)="assign()">
        {{ saving() ? 'Asignando…' : 'Asignar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .search {
      width: 100%;
      padding: 10px 14px;
      margin-bottom: 12px;
      border-radius: var(--vt-r-sm);
      border: 1px solid var(--vt-stroke-2);
      background: var(--vt-paper);
      color: var(--vt-ink);
      font: inherit;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 340px;
      overflow: auto;
    }
    .list button {
      width: 100%;
      display: grid;
      grid-template-columns: 64px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: var(--vt-r-sm);
      border: 1px solid var(--vt-divider);
      background: var(--vt-paper);
      color: var(--vt-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
      strong {
        font-weight: 800;
        font-size: 16px;
      }
      span {
        font-size: 13px;
        color: var(--vt-muted);
      }
      &.selected {
        border-color: var(--vt-primary);
        box-shadow: inset 0 0 0 1px var(--vt-primary);
        background: var(--vt-surface-2);
      }
    }
    .empty {
      padding: 20px;
      text-align: center;
      color: var(--vt-muted);
    }
    .error {
      margin: 12px 0 0;
      color: var(--vt-danger);
      font-weight: 600;
    }
  `,
})
export class AssignWearableDialog {
  private readonly ref = inject(MatDialogRef<AssignWearableDialog, Wearable>);
  private readonly store = inject(WearablesStore);
  private readonly queue = inject(QueueStore);
  protected readonly wearable = inject<Wearable>(MAT_DIALOG_DATA);

  protected readonly statusLabels = TICKET_STATUS_LABELS;
  protected readonly text = signal('');
  protected readonly selected = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly options = computed(() => {
    const busy = new Set(this.store.byTicket().keys());
    const q = this.text().trim().toLowerCase();
    return assignableTickets([...this.queue.waiting(), ...this.queue.inCare()], busy).filter(
      (t) => !q || t.code.toLowerCase().includes(q) || t.patient.displayName.toLowerCase().includes(q),
    );
  });

  protected pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  protected async assign(): Promise<void> {
    const id = this.selected();
    if (!id) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.ref.close(await this.store.assign(this.wearable, id));
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo asignar la pulsera'));
      this.saving.set(false);
    }
  }
}
