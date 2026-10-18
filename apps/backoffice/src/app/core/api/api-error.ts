import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje en español para mostrar: la API ya los manda así (`message: string | string[]`). */
export function apiErrorMessage(err: unknown, fallback = 'No se pudo completar la acción'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Sin conexión con el gateway';
    const msg = (err.error as { message?: string | string[] } | null)?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}
