import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logo Vitalia: isotipo (cruz médica + pulso + punto de conexión) y logotipo
 * "Vital" + "ia" en degradé. Equivalente al `VitaliaLogo` del portal cautivo (React).
 */
@Component({
  selector: 'vt-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo" [style.--size.px]="size()">
      <svg class="iso" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0D9488" />
            <stop offset="1" stop-color="#0284C7" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="42" height="42" rx="12" [attr.fill]="gradientUrl" />
        <rect x="20" y="10" width="8" height="28" rx="4" fill="#fff" opacity=".25" />
        <rect x="10" y="20" width="28" height="8" rx="4" fill="#fff" opacity=".25" />
        <path
          d="M12 24H18L21 16L27 32L30 24H36"
          stroke="#fff"
          stroke-width="3.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="36" cy="24" r="2.5" fill="#34D399" />
      </svg>
      <span class="type">
        <span class="word">Vital<span class="vt-text-gradient">ia</span></span>
        @if (subtitle()) {
          <span class="sub">{{ subtitle() }}</span>
        }
      </span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: calc(var(--size) * 0.28);
      user-select: none;
    }
    .iso {
      width: var(--size);
      height: var(--size);
      flex-shrink: 0;
    }
    .type {
      display: flex;
      flex-direction: column;
      line-height: 1.05;
    }
    .word {
      font-size: calc(var(--size) * 0.44);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--vt-ink);
    }
    .sub {
      margin-top: 2px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vt-muted-2);
    }
  `,
})
export class Logo {
  /** Alto del isotipo en px. */
  readonly size = input(40);
  /** Texto bajo el logotipo; `null` para ocultarlo. */
  readonly subtitle = input<string | null>('Ecosistema Digital Hospitalario');

  private static seq = 0;
  protected readonly gradientId = `vt-logo-grad-${++Logo.seq}`;
  protected readonly gradientUrl = `url(#${this.gradientId})`;
}
