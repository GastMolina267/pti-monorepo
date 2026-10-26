import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** 404 con la identidad Vitalia. */
@Component({
  selector: 'vt-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lp-container lp-section nf">
      <svg class="nf__line" viewBox="0 0 600 80" aria-hidden="true">
        <path d="M 0 40 L 180 40 L 200 40 L 214 14 L 234 66 L 252 4 L 266 40 L 600 40" />
      </svg>
      <h1>No encontramos esta página</h1>
      <p class="lp-lead">La página que buscás no existe o cambió de dirección.</p>
      <div class="nf__actions">
        <a class="lp-btn lp-btn--primary" routerLink="/">Ir al inicio</a>
        <a class="lp-btn lp-btn--ghost" routerLink="/instituciones">Ver la propuesta para instituciones</a>
      </div>
    </section>
  `,
  styles: `
    .nf {
      display: grid;
      gap: var(--lp-s-5);
      justify-items: start;
    }
    .nf__line {
      width: min(100%, 600px);
      height: 80px;
    }
    .nf__line path {
      fill: none;
      stroke: var(--vt-primary);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    h1 {
      font-size: var(--lp-text-6xl);
      line-height: 1;
      letter-spacing: -0.04em;
    }
    @media (max-width: 720px) {
      h1 {
        font-size: var(--lp-text-4xl);
        line-height: 40px;
      }
    }
    .nf__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--lp-s-3);
    }
  `,
})
export class NotFound {}
