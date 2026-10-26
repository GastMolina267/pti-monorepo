/** Interfaces que también aceptan conexiones por loopback: ahí alcanza con `localhost`. */
const LOOPBACK_REACHABLE = new Set(['', '0.0.0.0', '127.0.0.1', 'localhost']);

/**
 * Host para conectarse desde esta máquina a un puerto publicado del gateway
 * (`GATEWAY_HTTP_BIND` o `GATEWAY_MQTT_BIND`, ADR 0022). Con una IP puntual, Docker solo
 * escucha ahí y `localhost` no llega.
 */
export function gatewayHost(bind: string | undefined): string {
  const host = (bind ?? '').trim();
  return LOOPBACK_REACHABLE.has(host) ? 'localhost' : host;
}
