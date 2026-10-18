/**
 * `true` si `topic` coincide con el filtro MQTT `filter` (`+` = un nivel, `#` = el resto).
 * Ej.: `hospital/+/wearable/+/data` coincide con `hospital/sala1/wearable/wb-07-24d7cc/data`.
 */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
