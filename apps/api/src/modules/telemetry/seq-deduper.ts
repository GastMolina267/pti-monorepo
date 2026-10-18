/**
 * Deduplicación en memoria por `(wearableId, seq)` para los reenvíos de QoS 1.
 * Guarda los últimos `window` seq de cada wearable: alcanza para reenvíos y mensajes
 * desordenados. Si la API reinicia, el índice único `uq_readings_wearable_seq` evita la
 * lectura duplicada en la base y `AlertsService` no repite una alerta activa.
 */
export class SeqDeduper {
  private readonly seen = new Map<string, { set: Set<number>; order: number[] }>();

  constructor(private readonly window = 64) {}

  /** `true` si ya se vio; si no, lo registra y devuelve `false`. */
  isDuplicate(wearableId: string, seq: number): boolean {
    let entry = this.seen.get(wearableId);
    if (!entry) {
      entry = { set: new Set(), order: [] };
      this.seen.set(wearableId, entry);
    }
    if (entry.set.has(seq)) return true;
    entry.set.add(seq);
    entry.order.push(seq);
    if (entry.order.length > this.window) entry.set.delete(entry.order.shift() as number);
    return false;
  }
}
