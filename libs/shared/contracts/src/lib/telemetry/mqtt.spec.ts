import { CLINICAL_THRESHOLDS } from '../clinical/thresholds';
import { MQTT_TOPICS, TELEMETRY_READING_LIMITS } from './mqtt';

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

describe('MQTT_TOPICS', () => {
  it('arma el tópico de datos definido en la tesis', () => {
    expect(MQTT_TOPICS.wearableData('sala1', 'wb-07-24d7cc')).toBe(
      'hospital/sala1/wearable/wb-07-24d7cc/data',
    );
    expect(MQTT_TOPICS.allWearableData).toBe('hospital/+/wearable/+/data');
  });
});
