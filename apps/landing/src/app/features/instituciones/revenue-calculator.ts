import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { LucideRotateCcw } from '@lucide/angular';
import { MarketField } from './market-field';
import { Spotlight } from '../../shared/spotlight';
import {
  DEFAULT_ASSUMPTIONS,
  RANGES,
  type RevenueAssumptions,
  clampToRange,
  formatInt,
  formatPercent,
  formatUsd,
  projectRevenue,
} from './revenue-model';

interface Control {
  readonly key: keyof RevenueAssumptions;
  readonly label: string;
  readonly unit: 'usd' | 'int';
  readonly hint: string;
}

const CONTROLS: readonly Control[] = [
  {
    key: 'hospitals',
    label: 'Sedes que contratan',
    unit: 'int',
    hint: 'Hospitales o clínicas con Vitalia instalado.',
  },
  {
    key: 'wearablesPerHospital',
    label: 'Pulseras activas por sede',
    unit: 'int',
    hint: 'Promedio en uso al mismo tiempo.',
  },
  {
    key: 'monthlyFee',
    label: 'Abono por pulsera, por mes',
    unit: 'usd',
    hint: 'Referencia de mercado: US$ 10 a 40.',
  },
  {
    key: 'setupFee',
    label: 'Implementación por sede',
    unit: 'usd',
    hint: 'Pago único. Referencia: US$ 1.000 a 10.000.',
  },
  {
    key: 'hardwareCost',
    label: 'Costo de una pulsera',
    unit: 'usd',
    hint: 'Supuesto del equipo: confirmar con el costo real de componentes.',
  },
];

/**
 * Calculadora de ingresos: cada control mueve el escenario y el campo de puntos
 * enciende las sedes sobre los 6.729 establecimientos del país.
 */
@Component({
  selector: 'vt-revenue-calculator',
  imports: [Spotlight, MarketField, LucideRotateCcw],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './revenue-calculator.html',
  styleUrl: './revenue-calculator.scss',
})
export class RevenueCalculator {
  protected readonly controls = CONTROLS;
  protected readonly ranges = RANGES;
  protected readonly values = signal<RevenueAssumptions>({ ...DEFAULT_ASSUMPTIONS });
  protected readonly projection = computed(() => projectRevenue(this.values()));
  protected readonly isDefault = computed(() =>
    (Object.keys(DEFAULT_ASSUMPTIONS) as (keyof RevenueAssumptions)[]).every(
      (k) => this.values()[k] === DEFAULT_ASSUMPTIONS[k],
    ),
  );

  protected readonly usd = formatUsd;
  protected readonly int = formatInt;
  protected readonly pct = formatPercent;

  protected format(c: Control, v: number): string {
    return c.unit === 'usd' ? formatUsd(v) : formatInt(v);
  }

  protected update(key: keyof RevenueAssumptions, raw: string): void {
    const value = clampToRange(Number(raw), RANGES[key]);
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  protected reset(): void {
    this.values.set({ ...DEFAULT_ASSUMPTIONS });
  }
}
