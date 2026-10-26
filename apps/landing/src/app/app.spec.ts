import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App, audienceFromUrl } from './app';
import { appRoutes } from './app.routes';

describe('audienceFromUrl', () => {
  it('reconoce la página de instituciones con fragmento o query', () => {
    expect(audienceFromUrl('/instituciones')).toBe('instituciones');
    expect(audienceFromUrl('/instituciones#contacto')).toBe('instituciones');
    expect(audienceFromUrl('/instituciones?ref=tesis')).toBe('instituciones');
  });

  it('todo lo demás es la página de personas', () => {
    expect(audienceFromUrl('/')).toBe('personas');
    expect(audienceFromUrl('/#recorrido')).toBe('personas');
    expect(audienceFromUrl('/privacidad')).toBe('personas');
  });
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();
  });

  it('marca la audiencia activa en el selector y cambia el CTA', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/instituciones');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    const active = el.querySelector('.switch__opt[aria-current="page"]');
    expect(active?.textContent?.trim()).toBe('Instituciones');
    expect(el.querySelector('.switch')?.getAttribute('data-active')).toBe('instituciones');
    expect(el.querySelector('.nav__cta')?.textContent?.trim()).toBe('Pedir una demo');

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(el.querySelector('.switch__opt[aria-current="page"]')?.textContent?.trim()).toBe('Personas');
    expect(el.querySelector('.nav__cta')?.textContent?.trim()).toBe('Ver cómo funciona');
  });

  it('tiene enlace para saltar al contenido y pie con el equipo', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('a.skip')?.getAttribute('href')).toBe('#contenido');
    expect(el.querySelector('footer')?.textContent).toContain('Oscar Luis Gencarelli');
  });

  it('muestra la 404 en rutas desconocidas', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/no-existe');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'No encontramos esta página',
    );
  });
});
