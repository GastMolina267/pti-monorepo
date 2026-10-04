/** Zona horaria por defecto del hospital (Córdoba, Argentina). */
export const DEFAULT_TIMEZONE = 'America/Argentina/Cordoba';

/**
 * Día operativo `YYYY-MM-DD` en la zona horaria del hospital.
 * La numeración de turnos reinicia cada día operativo.
 */
export function toDayKey(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
