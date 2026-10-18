import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TRIAGE_LEVEL_LABELS, type TriageLevel } from '@vitalia/contracts';

/** Nivel de triaje con color **y** texto (nunca solo color). */
@Component({
  selector: 'vt-level-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [class]="'pill ' + cls()">{{ label() }}</span>`,
  styles: `
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.03em;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
      color: var(--lvl);
      background: color-mix(in srgb, var(--lvl) 14%, transparent);
      &::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--lvl);
      }
    }
    .stable {
      --lvl: color-mix(in srgb, var(--vt-success) 75%, var(--vt-ink));
    }
    .attention {
      --lvl: color-mix(in srgb, var(--vt-warning) 75%, var(--vt-ink));
    }
    .critical {
      --lvl: var(--vt-danger);
    }
  `,
})
export class LevelPill {
  readonly level = input.required<TriageLevel>();
  protected readonly cls = computed(() => this.level().toLowerCase());
  protected readonly label = computed(() => TRIAGE_LEVEL_LABELS[this.level()]);
}
