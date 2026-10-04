import { assessVitals } from './triage';

describe('assessVitals', () => {
  it('devuelve STABLE con valores normales', () => {
    expect(assessVitals({ hr: 78, spo2: 98, temp: 36.6 })).toEqual({ level: 'STABLE', reasons: [] });
  });

  it('marca CRITICAL ante una caída aunque los signos sean normales', () => {
    const r = assessVitals({ hr: 80, spo2: 97, fall: true });
    expect(r.level).toBe('CRITICAL');
    expect(r.reasons[0]).toBe('Caída detectada');
  });

  it('marca CRITICAL por hipoxia (SpO₂ < 90%)', () => {
    expect(assessVitals({ spo2: 87 }).level).toBe('CRITICAL');
  });

  it('marca ATTENTION por taquicardia leve o fiebre', () => {
    expect(assessVitals({ hr: 110 }).level).toBe('ATTENTION');
    expect(assessVitals({ temp: 38 }).level).toBe('ATTENTION');
  });

  it('ordena los motivos de mayor a menor severidad', () => {
    const r = assessVitals({ hr: 105, spo2: 85 });
    expect(r.level).toBe('CRITICAL');
    expect(r.reasons).toEqual(['Hipoxia (SpO₂ 85%)', 'Taquicardia (105 BPM)']);
  });
});
