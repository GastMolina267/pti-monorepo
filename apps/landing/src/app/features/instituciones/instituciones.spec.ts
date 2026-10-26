import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { buildMailto, ContactForm } from './contact-form';
import { Instituciones } from './instituciones';
import { MARKET_FACTS, REVENUE_STREAMS } from './instituciones.content';
import { shuffledIndices } from './market-field';
import { RevenueCalculator } from './revenue-calculator';

describe('Instituciones (B2B)', () => {
  it('cita una fuente por cada cifra de mercado', async () => {
    await TestBed.configureTestingModule({
      imports: [Instituciones],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Instituciones);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const facts = el.querySelectorAll('.fact');
    expect(facts.length).toBe(MARKET_FACTS.length);
    facts.forEach((f) => expect(f.querySelector('a.lp-source')?.getAttribute('href')).toMatch(/^https:\/\//));
    expect(el.querySelectorAll('.table__row').length).toBe(REVENUE_STREAMS.length);
    expect(el.querySelector('.table__row.is-roadmap .tag')?.textContent).toContain('Hoja de ruta');
  });
});

describe('RevenueCalculator', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [RevenueCalculator] }).compileComponents();
    const fixture = TestBed.createComponent(RevenueCalculator);
    await fixture.whenStable();
    return fixture;
  }

  const text = (el: HTMLElement, sel: string) =>
    el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();

  it('arranca con el escenario por defecto', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    expect(text(el, '.result__value')).toBe('US$ 51.840');
    expect(text(el, '.result__sub')).toContain('240 pulseras activas');
    expect((el.querySelector('.calc__reset') as HTMLButtonElement).disabled).toBe(true);
  });

  it('recalcula al mover un control y vuelve a los supuestos iniciales', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    const hospitals = el.querySelector<HTMLInputElement>('#ctrl-hospitals');
    if (!hospitals) throw new Error('falta el control de sedes');
    hospitals.value = '100';
    hospitals.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(text(el, '.result__value')).toBe('US$ 432.000');
    expect(text(el, '.field__legend')).toContain('100 en el escenario');

    (el.querySelector('.calc__reset') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(el, '.result__value')).toBe('US$ 51.840');
  });
});

describe('MarketField', () => {
  it('la permutación es determinística y completa', () => {
    const a = shuffledIndices(6729);
    const b = shuffledIndices(6729);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(new Set(a).size).toBe(6729);
    expect(Array.from(a.slice(0, 10))).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('ContactForm', () => {
  it('arma el mailto con asunto y cuerpo codificados', () => {
    const url = buildMailto('equipo@vitalia.example', {
      name: 'Lucía Ferreyra',
      organization: 'Clínica del Sol',
      profile: 'Hospital o clínica',
      email: 'lucia@clinicadelsol.example',
      message: 'Queremos ver un piloto en la guardia.',
    });
    expect(url.startsWith('mailto:equipo@vitalia.example?subject=')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('subject')).toBe('Vitalia · Hospital o clínica · Clínica del Sol');
    expect(params.get('body')).toContain('Queremos ver un piloto en la guardia.');
  });

  it('muestra errores en línea y no envía si falta información', async () => {
    await TestBed.configureTestingModule({ imports: [ContactForm] }).compileComponents();
    const fixture = TestBed.createComponent(ContactForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const errors = Array.from(el.querySelectorAll('.field__err')).map((e) => e.textContent?.trim());
    expect(errors).toHaveLength(4);
    expect(errors).toContain('Completá este campo.');
    expect(el.querySelector('#cf-email')?.getAttribute('aria-invalid')).toBe('true');
  });
});
