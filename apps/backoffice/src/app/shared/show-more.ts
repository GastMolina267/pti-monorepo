import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  type Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/** Filas que se dibujan por tanda en las listas largas (fila de triaje, Turnos). */
export const LIST_STEP = 50;

export interface Incremental<T> {
  /** Las primeras filas que se dibujan. */
  items: Signal<readonly T[]>;
  /** Cuántas quedan sin dibujar. */
  rest: Signal<number>;
  more(): void;
}

/**
 * Dibuja una lista larga por tandas. Con 10.000 turnos (prueba de estrés de la Fase 5c)
 * dibujar todas las filas tardaba 7–12 s; la API devuelve la lista completa y los
 * contadores siguen siendo los totales, pero el DOM solo tiene lo que se ve. Vuelve a la
 * primera tanda cuando cambia `resetOn` (el filtro), no cuando llega una lectura nueva.
 */
export function incremental<T>(
  source: () => readonly T[],
  resetOn: () => unknown,
  step = LIST_STEP,
): Incremental<T> {
  const limit = linkedSignal({ source: resetOn, computation: () => step });
  return {
    items: computed(() => source().slice(0, limit())),
    rest: computed(() => Math.max(0, source().length - limit())),
    more: () => limit.update((n) => n + step),
  };
}

@Component({
  selector: 'vt-show-more',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rest() > 0) {
      <div class="more">
        <button mat-stroked-button type="button" (click)="more.emit()">
          Mostrar {{ next() }} más <span class="rest">· quedan {{ rest() }}</span>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .more {
      display: flex;
      justify-content: center;
      padding: 12px 0 4px;
    }
    .rest {
      color: var(--vt-muted);
      font-weight: 500;
    }
  `,
})
export class ShowMore {
  readonly rest = input.required<number>();
  readonly step = input(LIST_STEP);
  readonly more = output<void>();
  protected readonly next = computed(() => Math.min(this.step(), this.rest()));
}
