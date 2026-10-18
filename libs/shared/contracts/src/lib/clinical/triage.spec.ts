import { assessVitals, isMoreSevere, vitalsFindings } from './triage';

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

describe('vitalsFindings', () => {
  it('asigna el tipo de alerta a cada hallazgo', () => {
    expect(vitalsFindings({ hr: 35, spo2: 85, temp: 34, fall: true })).toEqual([
      { level: 'CRITICAL', kind: 'FALL', reason: 'Caída detectada' },
      { level: 'CRITICAL', kind: 'HYPOXIA', reason: 'Hipoxia (SpO₂ 85%)' },
      { level: 'CRITICAL', kind: 'BRADYCARDIA', reason: 'Frecuencia cardíaca crítica (35 BPM)' },
      { level: 'CRITICAL', kind: 'HYPOTHERMIA', reason: 'Hipotermia (34 °C)' },
    ]);
  });

  it('distingue taquicardia crítica de bradicardia crítica', () => {
    expect(vitalsFindings({ hr: 140 })[0]).toMatchObject({ level: 'CRITICAL', kind: 'TACHYCARDIA' });
  });

  it('devuelve una lista vacía con signos normales', () => {
    expect(vitalsFindings({ hr: 78, spo2: 98, temp: 36.6, fall: false })).toEqual([]);
  });
});

describe('isMoreSevere', () => {
  it('compara niveles de triaje', () => {
    expect(isMoreSevere('CRITICAL', 'ATTENTION')).toBe(true);
    expect(isMoreSevere('ATTENTION', 'ATTENTION')).toBe(false);
    expect(isMoreSevere('STABLE', 'CRITICAL')).toBe(false);
  });
});
