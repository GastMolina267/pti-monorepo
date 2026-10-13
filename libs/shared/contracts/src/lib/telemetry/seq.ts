/**
 * `seq` de {@link TelemetryReading}: `arranque × 2^24 + contador`.
 *
 * El wearable guarda un contador de arranques en NVS (una escritura por arranque) y
 * reinicia el contador de mensajes en cada boot. Así `seq` crece siempre, también
 * después de un reinicio, y la deduplicación por `(wearableId, seq)` no descarta
 * lecturas nuevas. 2^24 mensajes por arranque ≈ 1,6 años publicando cada 3 s.
 *
 * Se usa multiplicación y no `<<`: en JS los desplazamientos son de 32 bits.
 */
export const SEQ_BOOT_SHIFT = 24;
const SEQ_BOOT_FACTOR = 2 ** SEQ_BOOT_SHIFT;
/** Mayor arranque que mantiene `seq` dentro de `Number.MAX_SAFE_INTEGER`. */
export const SEQ_MAX_BOOT = Math.floor(Number.MAX_SAFE_INTEGER / SEQ_BOOT_FACTOR) - 1;

export interface SeqParts {
  boot: number;
  counter: number;
}

/** `(3, 7)` → `50331655`. Lanza `RangeError` si alguna parte se sale de rango. */
export function composeSeq(boot: number, counter: number): number {
  if (!Number.isInteger(boot) || boot < 0 || boot > SEQ_MAX_BOOT) {
    throw new RangeError(`Arranque fuera de rango: ${boot}`);
  }
  if (!Number.isInteger(counter) || counter < 0 || counter >= SEQ_BOOT_FACTOR) {
    throw new RangeError(`Contador fuera de rango (0–2^24-1): ${counter}`);
  }
  return boot * SEQ_BOOT_FACTOR + counter;
}

/** Inversa de {@link composeSeq}, útil para diagnosticar reinicios desde la API. */
export function splitSeq(seq: number): SeqParts {
  return { boot: Math.floor(seq / SEQ_BOOT_FACTOR), counter: seq % SEQ_BOOT_FACTOR };
}
