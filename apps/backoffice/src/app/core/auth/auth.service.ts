import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  API_PREFIX,
  STAFF_ROLE_LABELS,
  type LoginRequest,
  type LoginResponse,
  type StaffRole,
  type StaffUser,
} from '@vitalia/contracts';
import { map, type Observable, tap } from 'rxjs';

/** Sesión del personal guardada en el navegador (el JWT dura un turno de 8 h). */
export interface Session {
  accessToken: string;
  /** Epoch en ms en que vence el token. */
  expiresAt: number;
  user: StaffUser;
}

export type LogoutReason = 'manual' | 'expired';

export const SESSION_STORAGE_KEY = 'vitalia_session';

function readSession(now = Date.now()): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.accessToken && s.expiresAt > now && s.user ? s : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* storage no disponible: la sesión vive solo en memoria */
  }
}

/**
 * Login del personal (JWT) y permisos por rol. El token se adjunta en `authInterceptor`
 * y en el handshake de Socket.IO (`RealtimeService`). Vence solo: al llegar `expiresAt`
 * (o ante un 401 o un `realtime:error`) se cierra la sesión y se vuelve al login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(readSession());
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.accessToken ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly roleLabel = computed(() => {
    const u = this.user();
    return u ? STAFF_ROLE_LABELS[u.role] : '';
  });

  constructor() {
    this.scheduleExpiry();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }

  login(req: LoginRequest): Observable<StaffUser> {
    return this.http.post<LoginResponse>(`/${API_PREFIX}/auth/login`, req).pipe(
      tap((res) =>
        this.setSession({
          accessToken: res.accessToken,
          expiresAt: Date.now() + res.expiresIn * 1000,
          user: res.user,
        }),
      ),
      map((res) => res.user),
    );
  }

  logout(reason: LogoutReason = 'manual'): void {
    if (!this.session()) return;
    const url = this.router.url;
    const redirect = url === '/' || url.startsWith('/login') ? undefined : url;
    this.setSession(null);
    void this.router.navigate(['/login'], {
      queryParams: {
        ...(reason === 'expired' ? { motivo: 'vencida' } : {}),
        ...(redirect ? { redirect } : {}),
      },
    });
  }

  /** `true` si el usuario tiene alguno de los roles (constantes `ROLES_CAN_*` de contracts). */
  can(roles: readonly StaffRole[]): boolean {
    const role = this.user()?.role;
    return role !== undefined && roles.includes(role);
  }

  private setSession(s: Session | null): void {
    this.session.set(s);
    writeSession(s);
    this.scheduleExpiry();
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const s = this.session();
    if (!s) return;
    // setTimeout acepta hasta ~24,8 días; el token dura horas.
    this.expiryTimer = setTimeout(() => this.logout('expired'), Math.max(0, s.expiresAt - Date.now()));
  }
}
