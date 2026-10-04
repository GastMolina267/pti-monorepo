/** Servicio de atención (define el prefijo del código de turno: A, B, C…). */
export interface ServiceArea {
  id: string;
  /** Código estable, ej. `CLINICA`, `GUARDIA`. */
  code: string;
  name: string;
  /** Letra del código de turno, ej. `A` → `A-024`. */
  prefix: string;
}

export interface ConsultingRoom {
  id: string;
  /** Código corto, ej. `C4`. */
  code: string;
  /** Nombre visible, ej. `Consultorio 4`. */
  name: string;
  specialty?: string | null;
}
