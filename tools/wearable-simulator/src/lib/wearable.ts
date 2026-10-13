import {
  MQTT_TOPICS,
  SEQ_MAX_BOOT,
  composeSeq,
  formatWearableCode,
  type TelemetryReading,
} from '@vitalia/contracts';
import type { Rng } from './rng';
import { VitalsModel, type AnomalyKind } from './vitals';

/**
 * Código de la pulsera simulada número `n`: `wb-NN-5e00NN`. Es el mismo esquema que usa el
 * seed de la API para `wb-02…wb-08` (sufijo de MAC inventado), así esas pulseras existen en
 * la base de desarrollo.
 */
export function simulatedCode(n: number): string {
  return formatWearableCode(n, `5e00${String(n).padStart(2, '0')}`);
}

const BOOT_EPOCH_MS = Date.UTC(2024, 0, 1);

/** Segundos desde 2024: base del arranque de las pulseras simuladas. */
export function initialBoot(nowMs: number): number {
  return Math.min(Math.floor((nowMs - BOOT_EPOCH_MS) / 1000), SEQ_MAX_BOOT);
}

/**
 * Arranque de una corrida nueva. El firmware guarda su contador de arranques en NVS; el
 * simulador guarda el último que usó (ver `boot-store.ts`) y arranca en el siguiente. La
 * hora es solo un piso: así, aunque se pierda el archivo, cada ejecución empieza en un bloque
 * de `seq` posterior y la deduplicación de la API no descarta las lecturas nuevas, incluso
 * si se reinicia dentro del mismo segundo o después de un `reboot` inyectado.
 */
export function nextBoot(nowMs: number, lastBoot?: number): number {
  const floor = initialBoot(nowMs);
  return lastBoot === undefined ? floor : Math.min(Math.max(floor, lastBoot + 1), SEQ_MAX_BOOT);
}

/** Una pulsera simulada: arma lecturas del contrato con `seq` y signos vitales coherentes. */
export class SimulatedWearable {
  readonly code: string;
  readonly topic: string;
  private readonly vitals: VitalsModel;
  private counter = 0;

  constructor(
    readonly number: number,
    room: string,
    rng: Rng,
    private boot: number,
  ) {
    this.code = simulatedCode(number);
    this.topic = MQTT_TOPICS.wearableData(room, this.code);
    this.vitals = new VitalsModel(rng);
  }

  nextReading(nowMs: number): TelemetryReading {
    const v = this.vitals.next(nowMs);
    return {
      wearableId: this.code,
      seq: composeSeq(this.boot, this.counter++),
      ts: nowMs,
      hr: v.hr,
      spo2: v.spo2,
      temp: v.temp,
      accPeakG: v.accPeakG,
      fall: v.fall,
    };
  }

  inject(kind: AnomalyKind, nowMs: number, durationMs: number): void {
    this.vitals.start(kind, nowMs, durationMs);
  }

  activeAnomaly(nowMs: number): AnomalyKind | null {
    return this.vitals.active(nowMs);
  }

  /** Como un reinicio del firmware: arranque siguiente y contador en 0. Devuelve el arranque nuevo. */
  reboot(): number {
    this.boot = Math.min(this.boot + 1, SEQ_MAX_BOOT);
    this.counter = 0;
    return this.boot;
  }
}
