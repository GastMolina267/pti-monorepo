import { acquireGatewayLock } from '../scripts/gateway-lock.mjs';

export default function setup(): () => void {
  return acquireGatewayLock();
}
