/**
 * Contrato MQTT entre el wearable (ESP32-C3) y el Edge Gateway (Mosquitto + NestJS).
 * Tópico definido en la tesis (§8.4): `hospital/<sala>/wearable/<id>/data`.
 */
export const MQTT_TOPIC_ROOT = 'hospital';

export const MQTT_TOPICS = {
  /** Publicación de lecturas de un wearable. */
  wearableData: (room: string, wearableId: string) =>
    `${MQTT_TOPIC_ROOT}/${room}/wearable/${wearableId}/data`,
  /** Comandos hacia un wearable (ej. mostrar turno en el OLED). */
  wearableCommand: (room: string, wearableId: string) =>
    `${MQTT_TOPIC_ROOT}/${room}/wearable/${wearableId}/cmd`,
  /** Suscripción del backend a todas las lecturas. */
  allWearableData: `${MQTT_TOPIC_ROOT}/+/wearable/+/data`,
} as const;

/** QoS 1: entrega garantizada al menos una vez (RNF / §5.1.3). */
export const MQTT_QOS = 1 as const;

/**
 * Sobre cifrado publicado por el wearable. El campo `ct` es el JSON de
 * {@link TelemetryReading} cifrado con AES-256 (ver docs/04-contratos.md).
 */
export interface EncryptedEnvelope {
  /** Versión del formato del sobre. */
  v: 1;
  /** Vector de inicialización, base64. */
  iv: string;
  /** Texto cifrado, base64. */
  ct: string;
  /** Tag de autenticación (AES-GCM), base64. */
  tag: string;
}

/** Lectura biométrica en claro (luego de descifrar). */
export interface TelemetryReading {
  wearableId: string;
  /** Contador monotónico para detectar pérdidas/duplicados (QoS 1). */
  seq: number;
  /** Epoch en milisegundos medido en el wearable. */
  ts: number;
  /** Frecuencia cardíaca (BPM). */
  hr?: number;
  /** Saturación de oxígeno (%). */
  spo2?: number;
  /** Temperatura clínica estimada (°C), ya compensada desde la piel. */
  temp?: number;
  /** Magnitud de aceleración pico (g) del último intervalo. */
  accPeakG?: number;
  /** `true` si el firmware detectó una caída (impacto > 2,8 g + inmovilidad). */
  fall?: boolean;
}
