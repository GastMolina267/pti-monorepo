import { composeSeq, type TelemetryReading } from '@vitalia/contracts';
import { parseDataTopic } from './data-topic';
import { parseReading } from './reading.schema';
import { SeqDeduper } from './seq-deduper';

const base: TelemetryReading = {
  wearableId: 'wb-07-24d7cc',
  seq: composeSeq(90_000_000, 12),
  ts: Date.UTC(2026, 9, 18, 12),
  hr: 78,
  spo2: 98,
  temp: 36.6,
  accPeakG: 1.02,
  fall: false,
};

describe('parseReading', () => {
  it('acepta una lectura del contrato (seq de un arranque alto incluido)', () => {
    expect(parseReading(base)).toEqual(base);
    expect(parseReading({ wearableId: base.wearableId, seq: 0, ts: base.ts })).toMatchObject({ seq: 0 });
  });

  it.each([
    ['un código fuera de formato', { wearableId: 'w-07' }, /wearableId/],
    ['un ts en segundos', { ts: 1791065563 }, /ts/],
    ['un seq negativo', { seq: -1 }, /seq/],
    ['un seq decimal', { seq: 1.5 }, /seq/],
    ['una frecuencia imposible', { hr: 400 }, /hr/],
    ['SpO₂ > 100', { spo2: 101 }, /spo2/],
    ['fall que no es boolean', { fall: 'true' }, /fall/],
    ['un campo fuera del contrato', { name: 'Lucía' }, /name|lectura/],
  ])('rechaza %s', (_case, patch, message) => {
    expect(() => parseReading({ ...base, ...patch })).toThrow(message);
  });
});

describe('parseDataTopic', () => {
  it('extrae sala y código', () => {
    expect(parseDataTopic('hospital/sala1/wearable/wb-07-24d7cc/data')).toEqual({
      room: 'sala1',
      wearableId: 'wb-07-24d7cc',
    });
  });

  it.each([
    'hospital/sala1/wearable/wb-07-24d7cc/cmd',
    'hospital/sala1/wearable/wb-07-24d7cc/data/plain',
    'otro/sala1/wearable/x/data',
  ])('rechaza %s', (topic) => expect(parseDataTopic(topic)).toBeNull());
});

describe('SeqDeduper', () => {
  it('detecta reenvíos por wearable y acepta mensajes desordenados', () => {
    const d = new SeqDeduper(3);
    expect(d.isDuplicate('a', 10)).toBe(false);
    expect(d.isDuplicate('a', 10)).toBe(true);
    expect(d.isDuplicate('b', 10)).toBe(false);
    expect(d.isDuplicate('a', 9)).toBe(false);
  });

  it('olvida los seq que salen de la ventana', () => {
    const d = new SeqDeduper(2);
    for (const s of [1, 2, 3]) d.isDuplicate('a', s);
    expect(d.isDuplicate('a', 1)).toBe(false);
    expect(d.isDuplicate('a', 3)).toBe(true);
  });
});
