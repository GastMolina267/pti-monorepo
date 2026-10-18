import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_PREFIX } from '@vitalia/contracts';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Adjunta el JWT a `/api/*` y, ante un 401, cierra la sesión (token vencido o revocado). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(`/${API_PREFIX}/`);
  const token = auth.token();
  const authed = isApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && isApi && token) auth.logout('expired');
      return throwError(() => err);
    }),
  );
};
