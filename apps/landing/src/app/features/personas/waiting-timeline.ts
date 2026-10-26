import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { animate, createTimeline, onScroll, stagger } from 'animejs';
import { Motion } from '../../core/motion';
import { Spotlight } from '../../shared/spotlight';

/** Una mañana de ejemplo en una guardia sin Vitalia. */
export const WAITING_DAY = [
  { time: '08:10', text: 'Llegás, sacás un número de papel y buscás una silla.', alert: false },
  { time: '09:25', text: 'Seguís sin saber cuántas personas tenés adelante.', alert: false },
  { time: '10:05', text: 'Te mareás en la silla. Nadie lo ve hasta que alguien pasa.', alert: true },
  { time: '11:40', text: 'Gritan tu nombre: si justo saliste un minuto, perdiste el lugar.', alert: false },
] as const;

/**
 * Línea de tiempo de una espera típica: la línea se dibuja con el scroll y cada
 * hora se enciende cuando la línea llega. Sin animaciones, se ve completa.
 */
@Component({
  selector: 'vt-waiting-timeline',
  imports: [Spotlight],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure vtSpotlight class="wt">
      <figcaption class="wt__cap">Una mañana en la guardia, hoy <span>(ejemplo)</span></figcaption>
      <div class="wt__body">
        <span class="wt__line" aria-hidden="true"><i></i></span>
        <ol class="wt__list">
          @for (e of day; track e.time) {
            <li class="wt__item" [class.is-alert]="e.alert">
              <time class="wt__time">{{ e.time }}</time>
              <p>{{ e.text }}</p>
            </li>
          }
        </ol>
      </div>
      <p class="wt__total"><strong>3 h 30 min</strong> de espera sin noticias, en el ejemplo.</p>
    </figure>
  `,
  styles: `
    :host {
      display: block;
    }
    .wt {
      margin: 0;
      display: grid;
      gap: var(--lp-s-5);
      padding: var(--lp-s-6);
      border-radius: var(--vt-r-lg);
      background: var(--vt-surface);
      border: 1px solid var(--vt-stroke);
    }
    .wt__cap {
      font-weight: 800;
    }
    .wt__cap span {
      font-weight: 500;
      color: var(--vt-muted);
    }
    .wt__body {
      position: relative;
    }
    .wt__list {
      margin: 0;
      padding: 0 0 0 var(--lp-s-7);
      list-style: none;
      display: grid;
      gap: var(--lp-s-5);
    }
    .wt__line {
      position: absolute;
      left: 11px;
      top: 8px;
      bottom: 8px;
      width: 2px;
      background: var(--vt-divider);
      border-radius: 2px;
    }
    .wt__line i {
      position: absolute;
      inset: 0;
      background: var(--vt-secondary);
      border-radius: 2px;
      transform-origin: top;
    }
    .wt__item {
      position: relative;
      display: grid;
      gap: 2px;
    }
    .wt__item::before {
      content: '';
      position: absolute;
      left: calc(-1 * var(--lp-s-7) + 4px);
      top: 4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--vt-paper);
      border: 3px solid var(--vt-secondary);
    }
    .wt__item.is-alert::before {
      border-color: var(--vt-danger);
      background: var(--vt-danger);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--vt-danger) 18%, transparent);
    }
    .wt__time {
      font-size: var(--lp-text-sm);
      line-height: 20px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--vt-secondary-deep);
    }
    :host-context([data-theme='dark']) .wt__time {
      color: var(--vt-secondary-light);
    }
    .is-alert .wt__time {
      color: var(--vt-danger-deep);
    }
    :host-context([data-theme='dark']) .is-alert .wt__time {
      color: var(--vt-danger);
    }
    .wt__item p {
      color: var(--vt-muted);
      max-width: 40ch;
    }
    .wt__total {
      padding-top: var(--lp-s-4);
      border-top: 1px solid var(--vt-divider);
      color: var(--vt-muted);
    }
    .wt__total strong {
      color: var(--vt-ink);
      font-weight: 800;
    }
    @media (max-width: 560px) {
      .wt {
        padding: var(--lp-s-5);
      }
    }
  `,
})
export class WaitingTimeline {
  protected readonly day = WAITING_DAY;

  constructor() {
    inject(Motion).scoped((_scope, root) => {
      const scroll = () =>
        onScroll({
          target: root,
          enter: { container: 'bottom', target: 'top' },
          leave: { container: 'center', target: 'bottom' },
          sync: 0.4,
        });
      animate(root.querySelectorAll('.wt__line i'), { scaleY: [0, 1], ease: 'linear', autoplay: scroll() });
      createTimeline({ autoplay: scroll() }).add(root.querySelectorAll('.wt__item'), {
        opacity: [0.25, 1],
        translateX: [12, 0],
        delay: stagger(250),
        duration: 400,
      });
    });
  }
}
