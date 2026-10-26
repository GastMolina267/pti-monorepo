import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideArrowRight, LucideBell } from '@lucide/angular';

/** Llamados de ejemplo (códigos y consultorios simulados). */
const CALLS = [
  { code: 'A-024', room: 'Consultorio 4' },
  { code: 'B-107', room: 'Traumatología' },
  { code: 'A-025', room: 'Consultorio 2' },
  { code: 'C-005', room: 'Pediatría' },
  { code: 'A-026', room: 'Consultorio 1' },
  { code: 'B-108', room: 'Rayos' },
  { code: 'C-006', room: 'Pediatría' },
] as const;

/**
 * Banda con estética del llamador de TV: los llamados pasan en loop. Es decorativa
 * (un lector de pantalla oye solo la descripción) y se queda quieta con menos movimiento.
 */
@Component({
  selector: 'vt-call-ticker',
  imports: [LucideBell, LucideArrowRight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ticker" aria-label="Ejemplo del llamador de la TV de la sala">
      <div class="ticker__tag" aria-hidden="true">
        <svg lucideBell [size]="18"></svg>
        <span>Llamador</span>
      </div>
      <div class="ticker__viewport" aria-hidden="true">
        <ul class="ticker__track">
          @for (round of [0, 1]; track round) {
            @for (c of calls; track $index) {
              <li>
                <strong>{{ c.code }}</strong>
                <svg class="ticker__arrow" lucideArrowRight [size]="18"></svg>
                <span>{{ c.room }}</span>
              </li>
            }
          }
        </ul>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .ticker {
      display: flex;
      align-items: stretch;
      background: var(--vt-ink);
      color: var(--vt-bg);
      overflow: hidden;
    }
    :host-context([data-theme='dark']) .ticker {
      background: var(--vt-paper);
      color: var(--vt-ink);
      border-block: 1px solid var(--vt-stroke);
    }
    .ticker__tag {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: var(--lp-s-2);
      padding: var(--lp-s-3) var(--lp-s-5);
      background: var(--vt-primary-deep);
      color: var(--vt-paper);
      font-size: var(--lp-text-sm);
      font-weight: 800;
      white-space: nowrap;
    }
    :host-context([data-theme='dark']) .ticker__tag {
      background: var(--vt-primary);
      color: var(--vt-bg);
    }
    .ticker__viewport {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      mask-image: linear-gradient(90deg, transparent, black 6%, black 94%, transparent);
    }
    .ticker__track {
      display: flex;
      width: max-content;
      margin: 0;
      padding: 0;
      list-style: none;
      animation: ticker 48s linear infinite;
    }
    .ticker:hover .ticker__track {
      animation-play-state: paused;
    }
    li {
      display: inline-flex;
      align-items: baseline;
      gap: var(--lp-s-2);
      padding: var(--lp-s-3) var(--lp-s-7);
      font-size: var(--lp-text-lg);
      line-height: 28px;
      font-weight: 700;
      white-space: nowrap;
      border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    }
    strong {
      font-weight: 800;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .ticker__arrow {
      align-self: center;
      opacity: 0.6;
    }
    @keyframes ticker {
      to {
        transform: translateX(-50%);
      }
    }
  `,
})
export class CallTicker {
  protected readonly calls = CALLS;
}
