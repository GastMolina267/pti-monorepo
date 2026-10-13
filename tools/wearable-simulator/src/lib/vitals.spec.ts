import { CLINICAL_THRESHOLDS, assessVitals } from '@vitalia/contracts';
import { createRng } from './rng';
import { ANOMALY_KINDS, VitalsModel, type Vitals } from './vitals';

const STEP_MS = 3000;

function run(model: VitalsModel, fromMs: number, readings: number): Vitals[] {
  return Array.from({ length: readings }, (_, i) => model.next(fromMs + i * STEP_MS));
}

describe('VitalsModel', () => {
  it('genera pacientes ESTABLES en reposo', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const readings = run(new VitalsModel(createRng(seed)), 0, 200);
      for (const r of readings) expect(assessVitals(r)).toEqual({ level: 'STABLE', reasons: [] });
    }
  });

  it.each([
    ['hypoxia', 'Hipoxia'],
    ['tachycardia', 'Frecuencia cardíaca crítica'],
    ['bradycardia', 'Frecuencia cardíaca crítica'],
    ['fever', 'Fiebre alta'],
    ['hypothermia', 'Hipotermia'],
  ] as const)('%s es CRÍTICO desde la primera lectura y se sostiene', (kind, reason) => {
    const model = new VitalsModel(createRng(7));
    run(model, 0, 5);
    model.start(kind, 15_000, 30_000);
    const during = run(model, 15_000, 10); // 27 s, dentro de la anomalía
    for (const r of during) {
      const assessment = assessVitals(r);
      expect(assessment.level).toBe('CRITICAL');
      expect(assessment.reasons[0]).toContain(reason);
    }
    expect(model.active(20_000)).toBe(kind);
  });

  it('vuelve gradualmente a ESTABLE cuando termina la anomalía', () => {
    const model = new VitalsModel(createRng(3));
    model.start('hypoxia', 0, 9000);
    const readings = run(model, 0, 40);
    expect(assessVitals(readings[0]).level).toBe('CRITICAL');
    expect(model.active(9000)).toBeNull();
    const levels = readings.slice(3).map((r) => assessVitals(r).level);
    expect(levels).toContain('ATTENTION'); // pasa por SpO₂ baja antes de normalizar
    expect(levels.slice(-10).every((l) => l === 'STABLE')).toBe(true);
  });

  it('una caída marca fall una sola vez, con impacto y después inmovilidad', () => {
    const model = new VitalsModel(createRng(5));
    model.start('fall', 0, 10_000);
    const [fall, ...after] = run(model, 0, 3);
    expect(fall.fall).toBe(true);
    expect(fall.accPeakG).toBeGreaterThan(CLINICAL_THRESHOLDS.fall.impactG);
    expect(assessVitals(fall).level).toBe('CRITICAL');
    for (const r of after) {
      expect(r.fall).toBe(false);
      expect(r.accPeakG).toBeLessThanOrEqual(1.06);
    }
    expect(model.active(9000)).toBe('fall');
    expect(model.active(10_000)).toBeNull();
  });

  it('en reposo nunca supera el umbral de impacto', () => {
    const readings = run(new VitalsModel(createRng(11)), 0, 500);
    expect(Math.max(...readings.map((r) => r.accPeakG))).toBeLessThan(CLINICAL_THRESHOLDS.fall.impactG);
  });

  it('respeta los rangos que valida fw:mqtt-check y los tipos del firmware', () => {
    const model = new VitalsModel(createRng(13));
    const readings: Vitals[] = [];
    let t = 0;
    for (const kind of ANOMALY_KINDS) {
      model.start(kind, t, 12_000);
      readings.push(...run(model, t, 8));
      t += 8 * STEP_MS;
    }
    for (const r of readings) {
      expect(Number.isInteger(r.hr) && r.hr >= 20 && r.hr <= 250).toBe(true);
      expect(Number.isInteger(r.spo2) && r.spo2 >= 50 && r.spo2 <= 100).toBe(true);
      expect(r.temp).toBeGreaterThanOrEqual(25);
      expect(r.temp).toBeLessThanOrEqual(45);
      expect(r.temp * 10).toBeCloseTo(Math.round(r.temp * 10), 6); // un decimal
      expect(r.accPeakG).toBeGreaterThanOrEqual(0);
      expect(r.accPeakG).toBeLessThanOrEqual(16);
    }
  });

  it('es determinístico con la misma semilla', () => {
    expect(run(new VitalsModel(createRng(42)), 0, 20)).toEqual(run(new VitalsModel(createRng(42)), 0, 20));
    expect(run(new VitalsModel(createRng(42)), 0, 20)).not.toEqual(
      run(new VitalsModel(createRng(43)), 0, 20),
    );
  });
});
