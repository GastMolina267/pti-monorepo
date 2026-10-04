/**
 * Umbrales clínicos de referencia tomados de la tesis (§5.1.1 y §8.4).
 * Prototipo académico: NO son valores certificados para uso clínico real.
 */
export const CLINICAL_THRESHOLDS = {
  heartRate: { normalMin: 60, normalMax: 100, criticalMin: 40, criticalMax: 130 },
  spo2: { normalMin: 95, criticalBelow: 90 },
  temperature: { feverAbove: 37.5, criticalAbove: 39.5, hypothermiaBelow: 35 },
  fall: { impactG: 2.8 },
} as const;

/** Latencias objetivo (RNF-O1 y Cuadro 11.1). */
export const LATENCY_TARGETS_MS = {
  alertDesign: 500,
  alertRequirement: 2000,
  restResponse: 50,
  ticketBroadcast: 100,
} as const;
