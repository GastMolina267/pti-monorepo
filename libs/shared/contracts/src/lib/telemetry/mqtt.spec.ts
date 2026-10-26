import { CLINICAL_THRESHOLDS } from '../clinical/thresholds';
import { dropOutOfRangeFields, MQTT_TOPICS, TELEMETRY_READING_LIMITS, type TelemetryReading } from './mqtt';

const reading: TelemetryReading = {
  wearableId: 'wb-01-24d7cc',
  seq: 16_777_223,
  ts: 1_792_556_854_152,
  hr: 78,
  spo2: 98,
  temp: 36.6,
  accPeakG: 1.02,
  fall: false,
};

describe('TELEMETRY_READING_LIMITS', () => {
  it('deja adentro todos los umbrales clínicos, así una alerta nunca se descarta por rango', () => {
    const { hr, spo2, temp } = TELEMETRY_READING_LIMITS;
    const T = CLINICAL_THRESHOLDS;
    for (const v of Object.values(T.heartRate)) expect(v).toBeGreaterThanOrEqual(hr.min);
    for (const v of Object.values(T.heartRate)) expect(v).toBeLessThanOrEqual(hr.max);
    for (const v of Object.values(T.spo2)) expect(v).toBeGreaterThanOrEqual(spo2.min);
    for (const v of Object.values(T.temperature)) expect(v).toBeGreaterThanOrEqual(temp.min);
    for (const v of Object.values(T.temperature)) expect(v).toBeLessThanOrEqual(temp.max);
    expect(T.fall.impactG).toBeLessThan(TELEMETRY_READING_LIMITS.accPeakG.max);
  });
});

describe('dropOutOfRangeFields', () => {
  it('deja igual una lectura en rango', () => {
    expect(dropOutOfRangeFields(reading)).toEqual({ reading, dropped: [] });
  });

  it('saca solo los campos fuera de rango y conserva el resto, fall incluido', () => {
    const { reading: kept, dropped } = dropOutOfRangeFields({ ...reading, temp: 23.3, hr: 999, fall: true });
    expect(dropped).toEqual(['hr', 'temp']);
    expect(kept).toEqual({
      wearableId: reading.wearableId,
      seq: reading.seq,
      ts: reading.ts,
      spo2: 98,
      accPeakG: 1.02,
      fall: true,
    });
  });

  it('los límites son inclusivos', () => {
    const { min, max } = TELEMETRY_READING_LIMITS.temp;
    expect(dropOutOfRangeFields({ ...reading, temp: min }).dropped).toEqual([]);
    expect(dropOutOfRangeFields({ ...reading, temp: max }).dropped).toEqual([]);
    expect(dropOutOfRangeFields({ ...reading, accPeakG: 16.01 }).dropped).toEqual(['accPeakG']);
  });

  it('no modifica la lectura que recibe', () => {
    const input = { ...reading, hr: 999 };
    dropOutOfRangeFields(input);
    expect(input.hr).toBe(999);
  });
});

describe('MQTT_TOPICS', () => {
  it('arma el tópico de datos definido en la tesis', () => {
    expect(MQTT_TOPICS.wearableData('sala1', 'wb-07-24d7cc')).toBe(
      'hospital/sala1/wearable/wb-07-24d7cc/data',
    );
    expect(MQTT_TOPICS.allWearableData).toBe('hospital/+/wearable/+/data');
  });
});
