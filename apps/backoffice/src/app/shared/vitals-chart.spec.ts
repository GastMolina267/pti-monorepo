import { TestBed } from '@angular/core/testing';
import type { VitalsHistory } from '@vitalia/contracts';
import { domainFor, linePath, VitalsChart } from './vitals-chart';

const history = (points: Partial<VitalsHistory['points'][number]>[]): VitalsHistory => ({
  ticketId: 't1',
  wearableCode: 'wb-03-5e0003',
  from: '2026-10-25T12:00:00.000Z',
  to: '2026-10-25T12:10:00.000Z',
  bucketSeconds: 3,
  alerts: [{ id: 'a1', kind: 'FALL', status: 'ACTIVE', detectedAt: '2026-10-25T12:05:00.000Z' }],
  points: points.map((p, i) => ({
    at: new Date(Date.UTC(2026, 9, 25, 12, 0, i * 3)).toISOString(),
    hr: 80,
    spo2: 97,
    temp: 36.6,
    accPeakG: 1,
    fall: false,
    level: 'STABLE',
    samples: 1,
    ...p,
  })),
});

describe('linePath / domainFor', () => {
  it('levanta el lápiz donde falta el dato', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }, null, { x: 3, y: 3 }])).toBe('M0.0,0.0L1.0,1.0M3.0,3.0');
  });

  it('amplía el eje si los datos se salen del rango del panel', () => {
    expect(domainFor([], [40, 140])).toEqual([40, 140]);
    expect(domainFor([35.4, 150.2], [40, 140])).toEqual([35, 151]);
  });
});

describe('VitalsChart', () => {
  it('dibuja tres paneles, marca el valor crítico y la alerta', async () => {
    TestBed.configureTestingModule({ imports: [VitalsChart] });
    const fixture = TestBed.createComponent(VitalsChart);
    fixture.componentRef.setInput('history', history([{}, { spo2: 85, level: 'CRITICAL' }, {}]));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('section.panel')).toHaveLength(3);
    expect(el.querySelectorAll('circle.critical')).toHaveLength(1);
    expect(el.querySelector('.marker-label')?.textContent).toBe('Caída');
    expect(el.querySelector('.now strong')?.textContent).toBe('80');
  });
});
