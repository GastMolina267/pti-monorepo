import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { animate, onScroll, stagger } from 'animejs';
import { Motion } from '../core/motion';

/**
 * Frase grande que se "enciende" palabra por palabra al scrollear (B11 de
 * landing-page-design). Sin animaciones, se ve completa desde el principio.
 */
@Component({
  selector: 'vt-tagline-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lp-container tagline" [attr.aria-label]="plain()">
      <p class="tagline__text" aria-hidden="true">
        @for (line of words(); track $index) {
          <span class="tagline__line">
            @for (w of line; track $index) {
              <span class="tagline__word">{{ w }}</span
              >{{ ' ' }}
            }
          </span>
        }
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .tagline {
      padding-block: var(--lp-s-11);
    }
    .tagline__text {
      max-width: 18ch;
      font-size: var(--lp-text-6xl);
      line-height: 1.04;
      font-weight: 800;
      letter-spacing: -0.035em;
      color: var(--vt-ink);
      text-wrap: balance;
    }
    .tagline__line {
      display: block;
    }
    .tagline__word {
      display: inline-block;
    }
    @media (max-width: 720px) {
      .tagline__text {
        font-size: var(--lp-text-4xl);
        line-height: 40px;
      }
    }
  `,
})
export class TaglineReveal {
  /** Una entrada por línea: los cortes van donde corta la idea. */
  readonly lines = input.required<readonly string[]>();

  protected readonly words = computed(() => this.lines().map((l) => l.split(/\s+/).filter(Boolean)));
  protected readonly plain = computed(() => this.lines().join(' '));

  constructor() {
    inject(Motion).scoped((_scope, root) => {
      const words = root.querySelectorAll('.tagline__word');
      animate(words, {
        opacity: [0.28, 1],
        duration: 400,
        delay: stagger(140),
        ease: 'out(3)',
        autoplay: onScroll({
          target: root,
          enter: { container: 'bottom', target: 'top' },
          leave: { container: 'center', target: 'bottom' },
          sync: 0.4,
        }),
      });
    });
  }
}
