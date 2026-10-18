/** Mensaje MQTT descartado por la ingesta. `reason` es apto para logs: nunca incluye signos vitales. */
export class TelemetryRejection extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
