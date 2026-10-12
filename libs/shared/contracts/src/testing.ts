/**
 * @vitalia/contracts/testing — datos SOLO para tests (API, firmware, simulador).
 * Va aparte del barrel principal para que Backoffice, TV y portal no lo importen ni por
 * error: incluye la clave de prueba de los vectores GCM, que nunca es una clave real.
 */
export * from './lib/telemetry/gcm-test-vectors';
