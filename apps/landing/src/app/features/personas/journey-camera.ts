/**
 * Geometría del recorrido: dónde está cada escena en el "mundo" SVG y por dónde
 * vuela la cámara. Puro y sin DOM, así se puede testear.
 */

export interface Camera {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneAnchor {
  readonly cx: number;
  readonly cy: number;
}

/** Tamaño total del mundo (viewBox de la vista general). */
export const WORLD = { w: 3400, h: 1000 } as const;

/** Centro de cada escena, en orden de recorrido. */
export const SCENES: readonly SceneAnchor[] = [
  { cx: 380, cy: 520 }, // celular y portal
  { cx: 1060, cy: 420 }, // pulsera
  { cx: 1720, cy: 560 }, // gateway en el hospital
  { cx: 2400, cy: 430 }, // consola de triaje
  { cx: 3040, cy: 520 }, // TV de la sala
];

/** Relación alto/ancho de la cámara: cuadrada; el SVG recorta (slice) lo que sobre. */
export const CAMERA_RATIO = 1;
/** Ancho visible cuando la cámara está "adentro" de una escena. */
export const FOCUS_W = 740;
/** Ancho visible a mitad de vuelo: se aleja para ver de dónde viene y a dónde va. */
export const FLIGHT_W = 1500;

export function cameraAt(cx: number, cy: number, w: number): Camera {
  const h = w * CAMERA_RATIO;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function focusCamera(index: number): Camera {
  const s = SCENES[index];
  return cameraAt(s.cx, s.cy, FOCUS_W);
}

/** Punto medio entre dos escenas, alejado: el "afuera" entre un interior y el siguiente. */
export function flightCamera(from: number, to: number): Camera {
  const a = SCENES[from];
  const b = SCENES[to];
  return cameraAt((a.cx + b.cx) / 2, (a.cy + b.cy) / 2 - 40, FLIGHT_W);
}

export function viewBox(c: Camera): string {
  return `${round(c.x)} ${round(c.y)} ${round(c.w)} ${round(c.h)}`;
}

/**
 * Cada paso ocupa un tramo igual del scroll (`SLOT` en el timeline). La cámara queda
 * quieta en la escena mientras el texto del paso pasa por el centro de la pantalla y
 * vuela a la siguiente entre un paso y otro.
 */
export const SLOT = 1000;
/** Parte del tramo en la que la cámara vuela (el resto, se queda en la escena). */
export const FLIGHT_SHARE = 0.6;

/** Inicio y duración del vuelo de la escena `from` a la siguiente, en tiempo de timeline. */
export function flightWindow(from: number): { start: number; duration: number } {
  const duration = SLOT * FLIGHT_SHARE;
  return { start: (from + 1) * SLOT - duration / 2, duration };
}

/** Paso activo para un progreso 0..1 del recorrido (cada paso ocupa el mismo tramo). */
export function stepForProgress(progress: number, steps = SCENES.length): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.min(steps - 1, Math.floor(p * steps));
}

/**
 * Trazo de la señal entre dos escenas: una curva suave con un latido (ECG) en el
 * medio, el mismo dibujo que el isotipo de Vitalia.
 */
export function signalPath(from: number, to: number): string {
  const a = SCENES[from];
  const b = SCENES[to];
  const x0 = a.cx + 200;
  const x1 = b.cx - 200;
  const mid = (x0 + x1) / 2;
  const yMid = (a.cy + b.cy) / 2 - 30;
  return [
    `M ${x0} ${a.cy}`,
    `C ${x0 + 90} ${a.cy} ${mid - 140} ${yMid} ${mid - 60} ${yMid}`,
    `L ${mid - 36} ${yMid - 38}`,
    `L ${mid - 6} ${yMid + 70}`,
    `L ${mid + 22} ${yMid - 58}`,
    `L ${mid + 40} ${yMid}`,
    `L ${mid + 60} ${yMid}`,
    `C ${mid + 140} ${yMid} ${x1 - 90} ${b.cy} ${x1} ${b.cy}`,
  ].join(' ');
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
