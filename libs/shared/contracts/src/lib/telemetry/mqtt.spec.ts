import { MQTT_TOPICS } from './mqtt';

describe('MQTT_TOPICS', () => {
  it('arma el tópico de datos definido en la tesis', () => {
    expect(MQTT_TOPICS.wearableData('sala1', 'w-07')).toBe('hospital/sala1/wearable/w-07/data');
    expect(MQTT_TOPICS.allWearableData).toBe('hospital/+/wearable/+/data');
  });
});
