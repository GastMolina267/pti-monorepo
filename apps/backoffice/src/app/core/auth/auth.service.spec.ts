import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ROLES_CAN_CALL, ROLES_CAN_MANAGE_WEARABLES, type LoginResponse } from '@vitalia/contracts';
import { firstValueFrom } from 'rxjs';
import { authGuard, guestGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService, SESSION_STORAGE_KEY } from './auth.service';

const RESPONSE: LoginResponse = {
  accessToken: 'jwt-de-prueba',
  expiresIn: 28800,
  user: { id: 'u1', email: 'medico@vitalia.local', fullName: 'Dra. Laura Fernández', role: 'DOCTOR' },
};

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    client: TestBed.inject(HttpClient),
    router: TestBed.inject(Router),
  };
}

async function login(auth: AuthService, http: HttpTestingController) {
  const p = firstValueFrom(auth.login({ email: 'medico@vitalia.local', password: 'x' }));
  http.expectOne('/api/auth/login').flush(RESPONSE);
  return p;
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('guarda la sesión al ingresar y expone usuario, token y permisos', async () => {
    const { auth, http } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    const user = await login(auth, http);
    expect(user.fullName).toBe('Dra. Laura Fernández');
    expect(auth.token()).toBe('jwt-de-prueba');
    expect(auth.roleLabel()).toBe('Médico/a');
    expect(auth.can(ROLES_CAN_CALL)).toBe(true);
    expect(auth.can(ROLES_CAN_MANAGE_WEARABLES)).toBe(false);
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').accessToken).toBe('jwt-de-prueba');
  });

  it('ignora una sesión guardada que ya venció', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: 'viejo', expiresAt: Date.now() - 1000, user: RESPONSE.user }),
    );
    expect(setup().auth.isLoggedIn()).toBe(false);
  });

  it('al cerrar sesión borra todo y vuelve al login', async () => {
    const { auth, http, router } = setup();
    await login(auth, http);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.logout('expired');
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(nav).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({ queryParams: { motivo: 'vencida' } }),
    );
  });
});

describe('authInterceptor', () => {
  beforeEach(() => localStorage.clear());

  it('adjunta el token solo a /api y cierra la sesión ante un 401', async () => {
    const { auth, http, client, router } = setup();
    await login(auth, http);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    client.get('/api/tickets').subscribe({ error: () => undefined });
    const req = http.expectOne('/api/tickets');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-de-prueba');

    client.get('/assets/x.json').subscribe();
    expect(http.expectOne('/assets/x.json').request.headers.has('Authorization')).toBe(false);

    req.flush({ message: 'Token inválido o vencido' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBe(false);
  });
});

describe('guards', () => {
  beforeEach(() => localStorage.clear());

  it('authGuard manda al login con redirect y guestGuard saca del login con sesión', async () => {
    const { auth, http } = setup();
    const run = (guard: typeof authGuard, url: string) =>
      TestBed.runInInjectionContext(() => guard({} as never, { url } as never));

    expect(String(run(authGuard, '/alertas'))).toBe('/login?redirect=%2Falertas');
    expect(run(guestGuard, '/login')).toBe(true);

    await login(auth, http);
    expect(run(authGuard, '/alertas')).toBe(true);
    expect(String(run(guestGuard, '/login'))).toBe('/triaje');
  });
});
