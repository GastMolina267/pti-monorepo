import { TestBed } from '@angular/core/testing';
import { Architecture, VLANS } from './architecture';
import { growthPath } from './fact-viz';

describe('Architecture (simulación de corte de internet)', () => {
  afterEach(() => vi.useRealTimers());

  async function render() {
    await TestBed.configureTestingModule({ imports: [Architecture] }).compileComponents();
    const fixture = TestBed.createComponent(Architecture);
    await fixture.whenStable();
    return fixture;
  }

  it('muestra las cuatro VLAN del router', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    expect(el.querySelectorAll('.vlans li').length).toBe(VLANS.length);
    expect(el.textContent).toContain('Internet conectado');
  });

  it('encola cambios sin internet y los sube al volver', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const button = () => el.querySelector<HTMLButtonElement>('.arch__btn');
    // Relojes falsos recién después de renderizar (TestBed necesita los reales).
    vi.useFakeTimers();

    button()?.click();
    vi.advanceTimersByTime(1200 * 3);
    fixture.detectChanges();
    expect(el.querySelector('.arch')?.classList).toContain('is-offline');
    expect(el.querySelector('.arch__status')?.textContent).toContain('3');
    expect(button()?.getAttribute('aria-pressed')).toBe('true');

    button()?.click();
    vi.advanceTimersByTime(160 * 3);
    fixture.detectChanges();
    expect(el.querySelector('.arch__status')?.textContent).toContain('Todo al día con la nube');
  });
});

describe('growthPath', () => {
  it('va de abajo a la izquierda hasta arriba a la derecha', () => {
    const d = growthPath({
      kind: 'growth',
      from: { year: 2025, value: 4.2, label: '' },
      to: { year: 2035, value: 33.56, label: '' },
      cagr: 0.231,
    });
    const pts = d
      .split(/[ML]/)
      .filter((p) => p.trim())
      .map((p) => p.trim().split(' ').map(Number));
    expect(pts).toHaveLength(11);
    expect(pts[0][0]).toBe(0);
    expect(pts[10]).toEqual([300, 8]);
    // Crecimiento compuesto: cada tramo sube más que el anterior.
    const rises = pts.slice(1).map((p, i) => pts[i][1] - p[1]);
    rises.slice(1).forEach((r, i) => expect(r).toBeGreaterThan(rises[i]));
  });
});
