import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Login } from './login';

const submit = (el: HTMLElement) => (el.querySelector('button[type=submit]') as HTMLButtonElement).click();

describe('Login', () => {
  beforeEach(() => localStorage.clear());

  async function setup() {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (sel: string, v: string) => {
      const input = el.querySelector(sel) as HTMLInputElement;
      input.value = v;
      input.dispatchEvent(new Event('input'));
    };
    return { fixture, el, type, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
  }

  it('no envía el formulario incompleto y muestra los errores en español', async () => {
    const { fixture, el, http } = await setup();
    submit(el);
    await fixture.whenStable();
    http.expectNone('/api/auth/login');
    expect(el.textContent).toContain('Ingresá tu email');
  });

  it('muestra el mensaje de la API si las credenciales no son válidas', async () => {
    const { fixture, el, type, http } = await setup();
    type('input[type=email]', 'medico@vitalia.local');
    type('input[type=password]', 'mala');
    submit(el);
    http
      .expectOne('/api/auth/login')
      .flush({ message: 'Email o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Email o contraseña incorrectos');
  });

  it('al ingresar navega a la fila de triaje', async () => {
    const { fixture, el, type, http, router } = await setup();
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    type('input[type=email]', 'medico@vitalia.local');
    type('input[type=password]', 'Vitalia2026!');
    submit(el);
    http.expectOne('/api/auth/login').flush({
      accessToken: 'jwt',
      expiresIn: 60,
      user: { id: 'u', email: 'medico@vitalia.local', fullName: 'Dra. X', role: 'DOCTOR' },
    });
    await fixture.whenStable();
    expect(nav).toHaveBeenCalledWith('/triaje');
  });
});
