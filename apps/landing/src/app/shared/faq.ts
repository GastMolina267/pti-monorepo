import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucidePlus } from '@lucide/angular';

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

/** Preguntas frecuentes con `<details>`: accesibles con teclado y sin JavaScript. */
@Component({
  selector: 'vt-faq',
  imports: [LucidePlus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="faq">
      @for (item of items(); track item.q) {
        <details class="faq__item">
          <summary>
            <span>{{ item.q }}</span>
            <svg lucidePlus class="faq__icon" [size]="20" aria-hidden="true"></svg>
          </summary>
          <p>{{ item.a }}</p>
        </details>
      }
    </div>
  `,
  styles: `
    .faq {
      border-top: 1px solid var(--vt-divider);
    }
    .faq__item {
      border-bottom: 1px solid var(--vt-divider);
    }
    summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lp-s-4);
      padding-block: var(--lp-s-5);
      font-size: var(--lp-text-lg);
      line-height: 28px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 6px;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      color: var(--vt-primary);
    }
    .faq__icon {
      flex-shrink: 0;
      color: var(--vt-primary);
      transition: transform 0.6s var(--lp-ease);
    }
    details[open] .faq__icon {
      transform: rotate(45deg);
    }
    p {
      max-width: var(--lp-measure);
      padding-bottom: var(--lp-s-5);
      color: var(--vt-muted);
    }
  `,
})
export class Faq {
  readonly items = input.required<readonly FaqItem[]>();
}
