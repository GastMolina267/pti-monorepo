import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Dónde se guarda el último arranque usado (el "NVS" del simulador). Fuera del repo. */
export const DEFAULT_BOOT_FILE = join(tmpdir(), 'vitalia-wearable-simulator', 'last-boot.json');

/**
 * Último arranque usado por el simulador. Es uno solo para todas las pulseras: alcanza con
 * que sea el mayor, porque la API deduplica por `(wearableId, seq)` y todas arrancan juntas.
 */
export class BootStore {
  constructor(private readonly file = DEFAULT_BOOT_FILE) {}

  /** `undefined` si no hay archivo o está dañado (entonces manda la hora, ver `nextBoot`). */
  load(): number | undefined {
    try {
      const { lastBoot } = JSON.parse(readFileSync(this.file, 'utf8')) as { lastBoot?: unknown };
      return Number.isSafeInteger(lastBoot) && (lastBoot as number) >= 0 ? (lastBoot as number) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Guarda `boot` si es mayor que el guardado. Escritura atómica (archivo temporal + rename). */
  save(boot: number): void {
    const last = this.load();
    if (last !== undefined && last >= boot) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ lastBoot: boot }));
    renameSync(tmp, this.file);
  }
}
