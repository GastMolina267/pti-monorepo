import { TestBed } from '@angular/core/testing';
import { CallTicker } from './call-ticker';
import { LiveVitals, SAMPLE_READINGS, peopleAhead } from './live-vitals';
import { WAITING_DAY, WaitingTimeline } from './waiting-timeline';

describe('peopleAhead', () => {
  it('baja de a una cada dos lecturas, llama y vuelve a empezar', () => {
    expect(Array.from({ length: 10 }, (_, t) => peopleAhead(t))).toEqual([3, 3, 2, 2, 1, 1, 0, 0, 3, 3]);
  });
});

describe('LiveVitals', () => {
  it('arranca con la primera lectura simulada y tres personas antes', async () => {
    await TestBed.configureTestingModule({ imports: [LiveVitals] }).compileComponents();
    const fixture = TestBed.createComponent(LiveVitals);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.lv__vals strong')?.textContent).toBe(String(SAMPLE_READINGS[0].hr));
    expect(el.querySelector('.lv__status')?.textContent?.trim()).toBe('3 personas antes');
    expect(el.querySelector('.lv__live')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('las lecturas de ejemplo están en rangos normales', () => {
    for (const r of SAMPLE_READINGS) {
      expect(r.hr).toBeGreaterThanOrEqual(60);
      expect(r.hr).toBeLessThanOrEqual(100);
      expect(r.spo2).toBeGreaterThanOrEqual(95);
      expect(r.temp).toBeLessThanOrEqual(37.5);
    }
  });
});

describe('WaitingTimeline y CallTicker', () => {
  it('muestra la mañana de ejemplo con la hora de la descompensación marcada', async () => {
    await TestBed.configureTestingModule({ imports: [WaitingTimeline, CallTicker] }).compileComponents();
    const t = TestBed.createComponent(WaitingTimeline);
    await t.whenStable();
    const el = t.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.wt__item').length).toBe(WAITING_DAY.length);
    expect(el.querySelector('.wt__item.is-alert time')?.textContent).toBe('10:05');

    const c = TestBed.createComponent(CallTicker);
    await c.whenStable();
    const ticker = c.nativeElement as HTMLElement;
    expect(ticker.querySelector('section')?.getAttribute('aria-label')).toContain('llamador');
    // La lista se duplica para que el loop no tenga cortes.
    expect(ticker.querySelectorAll('li').length % 2).toBe(0);
  });
});
