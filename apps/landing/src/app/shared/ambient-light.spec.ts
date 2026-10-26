import { TestBed } from '@angular/core/testing';
import { AmbientLight, PULSE_MS, RIPPLE_MS, glowIntensity, waveIntensity } from './ambient-light';

describe('glowIntensity', () => {
  it('es máximo bajo la luz, cae suave y se apaga en el borde', () => {
    expect(glowIntensity(0, 200)).toBe(1);
    expect(glowIntensity(100, 200)).toBeCloseTo(0.25);
    expect(glowIntensity(200, 200)).toBe(0);
    expect(glowIntensity(500, 200)).toBe(0);
  });
});

describe('waveIntensity', () => {
  it('brilla sobre el frente de la onda y se desvanece con la edad', () => {
    expect(waveIntensity(300, 300, 1)).toBe(1);
    expect(waveIntensity(345, 300, 1)).toBeCloseTo(0.5);
    expect(waveIntensity(400, 300, 1)).toBe(0);
    expect(waveIntensity(300, 300, 0.25)).toBeCloseTo(0.25);
    expect(waveIntensity(300, 300, -1)).toBe(0);
  });

  it('el latido dura menos que el período, como una lectura cada 3 s', () => {
    expect(PULSE_MS).toBe(3000);
    expect(RIPPLE_MS).toBeLessThan(PULSE_MS);
  });
});

describe('AmbientLight', () => {
  it('es decorativo y no captura eventos', async () => {
    await TestBed.configureTestingModule({ imports: [AmbientLight] }).compileComponents();
    const fixture = TestBed.createComponent(AmbientLight);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.amb')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('canvas')).not.toBeNull();
  });
});
