import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Rutas del personal: sin sesión, al login (volviendo después a la misma URL). */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** El login no se muestra si ya hay sesión. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/triaje']) : true;
