import { MQTT_TOPIC_ROOT } from '@vitalia/contracts';

export interface DataTopic {
  room: string;
  wearableId: string;
}

/** `hospital/<sala>/wearable/<id>/data` → `{ room, wearableId }`; `null` si no tiene esa forma. */
export function parseDataTopic(topic: string): DataTopic | null {
  const parts = topic.split('/');
  if (parts.length !== 5 || parts[0] !== MQTT_TOPIC_ROOT || parts[2] !== 'wearable' || parts[4] !== 'data') {
    return null;
  }
  const [, room, , wearableId] = parts;
  return room && wearableId ? { room, wearableId } : null;
}
