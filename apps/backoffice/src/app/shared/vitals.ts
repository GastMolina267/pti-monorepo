import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDroplet, LucideHeartPulse, LucidePersonStanding, LucideThermometer } from '@lucide/angular';
import { vitalsFindings, type TelemetryReading, type WearableLastReading } from '@vitalia/contracts';

type Tone = 'ok' | 'attention' | 'critical';

/** Tono de UN valor con la regla de contracts (`vitalsFindings` sobre ese campo solo). */
function tone(partial: Partial<TelemetryReading>): Tone {
  const level = vitalsFindings(partial)[0]?.level;
  return level === 'CRITICAL' ? 'critical' : level === 'ATTENTION' ? 'attention' : 'ok';
}

/** Signos vitales compactos de la última lectura de una pulsera. */
@Component({
  selector: 'vt-vitals',
  imports: [LucideHeartPulse, LucideDroplet, LucideThermometer, LucidePersonStanding],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reading(); as r) {
      <span class="v" [class]="'v ' + tones().hr" title="Frecuencia cardíaca">
        <svg lucideHeartPulse [size]="14"></svg>{{ r.hr ?? '—' }}<small>lpm</small>
      </span>
      <span class="v" [class]="'v ' + tones().spo2" title="Saturación de oxígeno">
        <svg lucideDroplet [size]="14"></svg>{{ r.spo2 ?? '—' }}<small>%</small>
      </span>
      <span class="v" [class]="'v ' + tones().temp" title="Temperatura">
        <svg lucideThermometer [size]="14"></svg>{{ r.temp ?? '—' }}<small>°C</small>
      </span>
      @if (r.fall) {
        <span class="v critical fall"><svg lucidePersonStanding [size]="14"></svg>Caída</span>
      }
    } @else {
      <span class="none">{{ emptyText() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .v {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      background: var(--vt-surface-2);
      color: var(--vt-ink);
      small {
        font-size: 10.5px;
        font-weight: 700;
        color: var(--vt-muted);
      }
      svg {
        color: var(--vt-muted);
      }
    }
    .attention {
      color: var(--vt-warning-deep);
      background: color-mix(in srgb, var(--vt-warning) 14%, transparent);
      svg {
        color: currentColor;
      }
    }
    .critical {
      color: var(--vt-danger);
      background: color-mix(in srgb, var(--vt-danger) 14%, transparent);
      svg {
        color: currentColor;
      }
    }
    .none {
      font-size: 12.5px;
      color: var(--vt-muted-2);
    }
  `,
})
export class Vitals {
  readonly reading = input<WearableLastReading | null>(null);
  readonly emptyText = input('Sin lecturas');

  protected readonly tones = computed(() => {
    const r = this.reading();
    return {
      hr: r?.hr == null ? 'ok' : tone({ hr: r.hr }),
      spo2: r?.spo2 == null ? 'ok' : tone({ spo2: r.spo2 }),
      temp: r?.temp == null ? 'ok' : tone({ temp: r.temp }),
    };
  });
}
