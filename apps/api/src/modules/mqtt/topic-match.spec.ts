import { MQTT_TOPICS } from '@vitalia/contracts';
import { topicMatches } from './topic-match';

describe('topicMatches', () => {
  const data = MQTT_TOPICS.wearableData('sala1', 'wb-07-24d7cc');

  it('resuelve los comodines + del filtro de lecturas', () => {
    expect(topicMatches(MQTT_TOPICS.allWearableData, data)).toBe(true);
    expect(
      topicMatches(MQTT_TOPICS.allWearableData, MQTT_TOPICS.wearableCommand('sala1', 'wb-07-24d7cc')),
    ).toBe(false);
    expect(topicMatches(MQTT_TOPICS.allWearableData, `${data}/plain`)).toBe(false);
  });

  it('resuelve # y tópicos exactos', () => {
    expect(topicMatches('hospital/#', data)).toBe(true);
    expect(topicMatches(data, data)).toBe(true);
    expect(topicMatches('hospital/sala2/#', data)).toBe(false);
  });
});
