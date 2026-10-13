/** Generador pseudoaleatorio en [0, 1). */
export type Rng = () => number;

/**
 * PRNG determinístico (mulberry32): con la misma semilla, el simulador genera las mismas
 * lecturas. Sirve para repetir una prueba de carga o un escenario de demo tal cual.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número uniforme en [min, max). */
export function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Ruido uniforme en [-amplitude, amplitude). */
export function jitter(rng: Rng, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude;
}
