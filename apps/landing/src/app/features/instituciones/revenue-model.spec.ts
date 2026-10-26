import {
  DEFAULT_ASSUMPTIONS,
  MARKET,
  RANGES,
  clampToRange,
  formatPercent,
  formatUsd,
  projectRevenue,
} from './revenue-model';

describe('projectRevenue', () => {
  it('calcula el escenario por defecto', () => {
    const p = projectRevenue(DEFAULT_ASSUMPTIONS);
    expect(p.activeWearables).toBe(240);
    expect(p.mrr).toBe(4320);
    expect(p.arr).toBe(51840);
    expect(p.setupRevenue).toBe(42000);
    expect(p.firstYear).toBe(93840);
    expect(p.hardwareInvestment).toBe(8400);
    expect(p.hardwarePaybackMonths).toBe(2);
    expect(p.marketShare).toBeCloseTo(12 / 6729, 8);
  });

  it('redondea hacia arriba los meses para cubrir el hardware', () => {
    const p = projectRevenue({ ...DEFAULT_ASSUMPTIONS, hardwareCost: 37, monthlyFee: 18 });
    expect(p.hardwarePaybackMonths).toBe(3);
  });

  it('no divide por cero sin abono', () => {
    expect(projectRevenue({ ...DEFAULT_ASSUMPTIONS, monthlyFee: 0 }).hardwarePaybackMonths).toBe(Infinity);
  });

  it('usa los datos de REFES 2023', () => {
    expect(MARKET.publicEstablishments + MARKET.privateEstablishments).toBe(MARKET.establishments);
  });

  it('los valores por defecto están dentro de los rangos', () => {
    for (const key of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
      expect(clampToRange(DEFAULT_ASSUMPTIONS[key], RANGES[key])).toBe(DEFAULT_ASSUMPTIONS[key]);
    }
  });
});

describe('clampToRange', () => {
  const r = { min: 500, max: 10000, step: 100 };

  it('ajusta al paso y a los límites', () => {
    expect(clampToRange(3549, r)).toBe(3500);
    expect(clampToRange(3551, r)).toBe(3600);
    expect(clampToRange(-20, r)).toBe(500);
    expect(clampToRange(99999, r)).toBe(10000);
  });

  it('descarta valores no numéricos', () => {
    expect(clampToRange(Number.NaN, r)).toBe(500);
  });
});

describe('formato es-AR', () => {
  it('formatea dólares y porcentajes', () => {
    expect(formatUsd(51840).replace(/\s/g, ' ')).toBe('US$ 51.840');
    // El espacio antes del % depende de la versión de ICU: se compara sin espacios.
    expect(formatPercent(12 / 6729).replace(/\s/g, '')).toBe('0,18%');
  });
});
