import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  LucideActivity,
  LucideBellRing,
  LucideHeartPulse,
  LucideMegaphone,
  LucideRefreshCw,
  LucideUsers,
  LucideWatch,
} from '@lucide/angular';
import { assessVitals, TelemetryReading, TriageLevel } from '@vitalia/contracts';
import { HealthApi } from '../../core/api/health.api';

interface PreviewPatient {
  ticket: string;
  name: string;
  reading: Partial<TelemetryReading>;
}

const LEVEL_LABEL: Record<TriageLevel, string> = {
  STABLE: 'Estable',
  ATTENTION: 'Atención',
  CRITICAL: 'Crítico',
};
const LEVEL_ORDER: Record<TriageLevel, number> = { CRITICAL: 0, ATTENTION: 1, STABLE: 2 };

@Component({
  selector: 'vt-home',
  imports: [
    LucideActivity,
    LucideBellRing,
    LucideHeartPulse,
    LucideMegaphone,
    LucideRefreshCw,
    LucideUsers,
    LucideWatch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly api = inject(HealthApi);
  protected readonly health = this.api.health;
  protected readonly levelLabel = LEVEL_LABEL;

  protected readonly apiState = computed(() => {
    if (this.health.isLoading()) return { cls: 'loading', text: 'Verificando API…' };
    const h = this.health.value();
    if (h?.status === 'ok') return { cls: 'ok', text: `API en línea · v${h.version} · ${h.environment}` };
    return { cls: 'down', text: 'API sin conexión — ¿corriste pnpm dev:api?' };
  });

  /** Datos de ejemplo: la clasificación usa la misma regla que la API (@vitalia/contracts). */
  private readonly sample: PreviewPatient[] = [
    { ticket: 'A-021', name: 'Lucía G.', reading: { hr: 78, spo2: 98, temp: 36.6 } },
    { ticket: 'A-022', name: 'Martín R.', reading: { hr: 112, spo2: 96, temp: 37.9 } },
    { ticket: 'A-023', name: 'Rosa P.', reading: { hr: 88, spo2: 87, temp: 36.9, fall: true } },
    { ticket: 'A-024', name: 'Diego F.', reading: { hr: 64, spo2: 97, temp: 36.4 } },
  ];

  protected readonly queue = this.sample
    .map((p) => ({ ...p, assessment: assessVitals(p.reading) }))
    .sort((a, b) => LEVEL_ORDER[a.assessment.level] - LEVEL_ORDER[b.assessment.level]);

  protected readonly modules = [
    {
      icon: 'users',
      title: 'Fila de triaje',
      desc: 'Pacientes en espera ordenados por estado crítico.',
      phase: 'Fase 3',
      tone: 'teal',
    },
    {
      icon: 'bell',
      title: 'Alertas biométricas',
      desc: 'Avisos visuales y sonoros ante caídas o anomalías.',
      phase: 'Fase 2–3',
      tone: 'rose',
    },
    {
      icon: 'megaphone',
      title: 'Llamador de turnos',
      desc: 'Llamado a consultorio reflejado en TV, app y wearable.',
      phase: 'Fase 3',
      tone: 'blue',
    },
    {
      icon: 'watch',
      title: 'Wearables',
      desc: 'Estado de las pulseras IoMT y su última lectura.',
      phase: 'Fase 2',
      tone: 'indigo',
    },
  ] as const;
}
