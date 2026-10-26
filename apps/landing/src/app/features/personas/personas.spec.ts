import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Personas } from './personas';
import { FAQ_PERSONAS, JOURNEY } from './personas.content';

describe('Personas (B2C)', () => {
  async function render() {
    await TestBed.configureTestingModule({
      imports: [Personas],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Personas);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el titular y un único CTA en el hero', async () => {
    const el = await render();
    expect(el.querySelector('h1')?.textContent).toContain('La sala de espera');
    expect(el.querySelectorAll('.hero .lp-btn').length).toBe(1);
  });

  it('sin animaciones, se ven los cinco pasos del recorrido y el mapa completo', async () => {
    const el = await render();
    const steps = el.querySelectorAll('.step');
    expect(steps.length).toBe(JOURNEY.length);
    expect(el.querySelectorAll('.step.is-dim').length).toBe(0);
    expect(el.querySelector('.stage__svg')?.getAttribute('viewBox')).toBe('0 0 3400 1000');
    expect(el.querySelector('.caption')).toBeNull();
  });

  it('la frase grande queda legible para lectores de pantalla', async () => {
    const el = await render();
    expect(el.querySelector('vt-tagline-reveal section')?.getAttribute('aria-label')).toBe(
      'Mientras esperás, el hospital no te pierde de vista.',
    );
  });

  it('lista las preguntas frecuentes y lleva a la propuesta para instituciones', async () => {
    const el = await render();
    expect(el.querySelectorAll('vt-faq details').length).toBe(FAQ_PERSONAS.length);
    expect(el.querySelector('.bridge a')?.getAttribute('href')).toBe('/instituciones');
  });
});
