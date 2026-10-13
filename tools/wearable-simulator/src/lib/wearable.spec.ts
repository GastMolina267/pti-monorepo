import { MQTT_TOPICS, WEARABLE_CODE_PATTERN, composeSeq, splitSeq } from '@vitalia/contracts';
import { createRng } from './rng';
import { SimulatedWearable, initialBoot, simulatedCode } from './wearable';

describe('simulatedCode', () => {
  it('usa el mismo esquema que el seed de la API (wb-02-5e0002 … wb-08-5e0008)', () => {
    expect(simulatedCode(2)).toBe('wb-02-5e0002');
    expect(simulatedCode(8)).toBe('wb-08-5e0008');
  });

  it('genera códigos válidos para todo el rango', () => {
    for (let n = 1; n <= 99; n++) expect(simulatedCode(n)).toMatch(WEARABLE_CODE_PATTERN);
  });
});

describe('initialBoot', () => {
  it('crece con el tiempo, así cada corrida usa un bloque de seq nuevo', () => {
    const now = Date.UTC(2026, 9, 13, 12, 0, 0);
    expect(initialBoot(now + 1000)).toBe(initialBoot(now) + 1);
    expect(composeSeq(initialBoot(now + 1000), 0)).toBeGreaterThan(composeSeq(initialBoot(now), 5000));
  });
});

describe('SimulatedWearable', () => {
  const make = () => new SimulatedWearable(3, 'sala1', createRng(1), 100);

  it('publica en su tópico del contrato', () => {
    expect(make().topic).toBe(MQTT_TOPICS.wearableData('sala1', 'wb-03-5e0003'));
  });

  it('arma lecturas con seq consecutivo y la hora recibida', () => {
    const w = make();
    const a = w.nextReading(1_000);
    const b = w.nextReading(4_000);
    expect(a).toMatchObject({ wearableId: 'wb-03-5e0003', seq: composeSeq(100, 0), ts: 1_000 });
    expect(b.seq).toBe(composeSeq(100, 1));
    expect(Object.keys(a)).toEqual(['wearableId', 'seq', 'ts', 'hr', 'spo2', 'temp', 'accPeakG', 'fall']);
  });

  it('un reinicio salta al bloque siguiente y el seq sigue creciendo', () => {
    const w = make();
    const before = w.nextReading(0);
    w.nextReading(3000);
    w.reboot();
    const after = w.nextReading(6000);
    expect(splitSeq(after.seq)).toEqual({ boot: 101, counter: 0 });
    expect(after.seq).toBeGreaterThan(before.seq);
  });

  it('expone la anomalía activa', () => {
    const w = make();
    expect(w.activeAnomaly(0)).toBeNull();
    w.inject('fever', 0, 10_000);
    expect(w.activeAnomaly(5_000)).toBe('fever');
  });
});
