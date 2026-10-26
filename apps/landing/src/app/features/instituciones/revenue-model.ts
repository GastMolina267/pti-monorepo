/**
 * Modelo de ingresos de Vitalia para la calculadora de Instituciones.
 *
 * Los valores por defecto son SUPUESTOS del equipo, ubicados dentro de los rangos de
 * referencia del monitoreo remoto de pacientes (HealthArc). No son precios ni una
 * proyección financiera: la página los muestra como estimación editable.
 */

/** Establecimientos con internación en Argentina (REFES 2023, Ministerio de Salud). */
export const MARKET = {
  establishments: 6729,
  publicEstablishments: 1743,
  privateEstablishments: 4986,
  beds: 236183,
} as const;

export interface RevenueAssumptions {
  /** Sedes que contratan el servicio. */
  hospitals: number;
  /** Pulseras activas promedio por sede. */
  wearablesPerHospital: number;
  /** Abono mensual por pulsera activa, en USD. */
  monthlyFee: number;
  /** Implementación por sede (pago único), en USD. */
  setupFee: number;
  /** Costo del hardware de una pulsera, en USD (supuesto: confirmar con el BOM). */
  hardwareCost: number;
}

export interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const DEFAULT_ASSUMPTIONS: Readonly<RevenueAssumptions> = {
  hospitals: 12,
  wearablesPerHospital: 20,
  monthlyFee: 18,
  setupFee: 3500,
  hardwareCost: 35,
};

export const RANGES: Readonly<Record<keyof RevenueAssumptions, Range>> = {
  hospitals: { min: 1, max: 300, step: 1 },
  wearablesPerHospital: { min: 5, max: 100, step: 1 },
  monthlyFee: { min: 5, max: 40, step: 1 },
  setupFee: { min: 500, max: 10000, step: 100 },
  hardwareCost: { min: 15, max: 100, step: 1 },
};

export interface RevenueProjection {
  activeWearables: number;
  /** Ingreso recurrente mensual. */
  mrr: number;
  /** Ingreso recurrente anual. */
  arr: number;
  /** Implementaciones cobradas en el año (una por sede). */
  setupRevenue: number;
  /** Primer año: recurrente + implementaciones. */
  firstYear: number;
  /** Hardware que hay que fabricar para entregar las pulseras en comodato. */
  hardwareInvestment: number;
  /** Meses de abono que cubren el hardware entregado (se redondea hacia arriba). */
  hardwarePaybackMonths: number;
  /** Porción de los establecimientos con internación (0..1). */
  marketShare: number;
}

/** Ajusta un valor al rango y al paso de la calculadora. */
export function clampToRange(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.min;
  const stepped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return Math.min(range.max, Math.max(range.min, stepped));
}

export function projectRevenue(a: RevenueAssumptions): RevenueProjection {
  const activeWearables = a.hospitals * a.wearablesPerHospital;
  const mrr = activeWearables * a.monthlyFee;
  const arr = mrr * 12;
  const setupRevenue = a.hospitals * a.setupFee;
  const hardwareInvestment = activeWearables * a.hardwareCost;
  return {
    activeWearables,
    mrr,
    arr,
    setupRevenue,
    firstYear: arr + setupRevenue,
    hardwareInvestment,
    hardwarePaybackMonths: a.monthlyFee > 0 ? Math.ceil(a.hardwareCost / a.monthlyFee) : Infinity,
    marketShare: a.hospitals / MARKET.establishments,
  };
}

const usd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('es-AR', {
  style: 'percent',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export const formatUsd = (n: number) => usd.format(n);
export const formatInt = (n: number) => int.format(n);
export const formatPercent = (n: number) => pct.format(n);
