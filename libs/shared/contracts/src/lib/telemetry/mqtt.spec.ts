import { MQTT_TOPICS } from './mqtt';

describe('MQTT_TOPICS', () => {
  it('arma el tópico de datos definido en la tesis', () => {
    expect(MQTT_TOPICS.wearableData('sala1', 'wb-07-24d7cc')).toBe(
      'hospital/sala1/wearable/wb-07-24d7cc/data',
    );
    expect(MQTT_TOPICS.allWearableData).toBe('hospital/+/wearable/+/data');
  });
});
