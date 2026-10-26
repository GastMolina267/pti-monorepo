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

/** Versión actual del formato de {@link EncryptedEnvelope}. */
export const ENVELOPE_VERSION = 1 as const;

/** Parámetros del cifrado de la telemetría: AES-256-GCM sin AAD (ADR 0006). */
export const TELEMETRY_CIPHER = {
  algorithm: 'aes-256-gcm',
  keyBytes: 32,
  ivBytes: 12,
  tagBytes: 16,
} as const;

/**
 * Sobre cifrado publicado por el wearable. El campo `ct` es el JSON de
 * {@link TelemetryReading} cifrado con AES-256 (ver docs/04-contratos.md).
 */
export interface EncryptedEnvelope {
  /** Versión del formato del sobre. */
  v: typeof ENVELOPE_VERSION;
  /** Vector de inicialización, base64. */
  iv: string;
  /** Texto cifrado, base64. */
  ct: string;
  /** Tag de autenticación (AES-GCM), base64. */
  tag: string;
}

/** Lectura biométrica en claro (luego de descifrar). */
export interface TelemetryReading {
  /** Código del wearable, `wb-<NN>-<mac>` (ver {@link formatWearableCode}). */
  wearableId: string;
  /**
   * Contador monotónico para detectar pérdidas/duplicados (QoS 1). Sigue creciendo
   * entre reinicios: el firmware lo arma como `(arranque << 24) | contador`, así que
   * después de reiniciar salta al bloque siguiente (ver {@link composeSeq}).
   */
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

/**
 * Rangos físicamente posibles de cada medición (no clínicos: eso es `assessVitals`). Un valor
 * afuera es un sensor sin poner o roto: la API descarta **solo ese campo** y conserva el resto
 * de la lectura, `fall` incluido ({@link dropOutOfRangeFields}). El wearable igual no los manda:
 * - `hr`, `spo2`, `temp`: se omiten. Un `temp` < 25 °C es la pulsera sin poner (mide el aire).
 * - `accPeakG`: se satura en `max`. En un golpe fuerte la magnitud de los tres ejes puede
 *   pasar los 16 g aunque cada eje sature ahí, y esa lectura es justo la que lleva `fall`.
 */
export const TELEMETRY_READING_LIMITS = {
  hr: { min: 20, max: 250 },
  spo2: { min: 50, max: 100 },
  temp: { min: 25, max: 45 },
  accPeakG: { min: 0, max: 16 },
} as const satisfies Record<
  keyof Pick<TelemetryReading, 'hr' | 'spo2' | 'temp' | 'accPeakG'>,
  { min: number; max: number }
>;

/** Mediciones con rango físico en {@link TELEMETRY_READING_LIMITS}. */
export type LimitedReadingField = keyof typeof TELEMETRY_READING_LIMITS;

/**
 * Saca de la lectura las mediciones fuera de {@link TELEMETRY_READING_LIMITS} (límites
 * inclusivos) y devuelve cuáles sacó. No valida tipos: eso lo hace quien parsea el mensaje.
 */
export function dropOutOfRangeFields(reading: TelemetryReading): {
  reading: TelemetryReading;
  dropped: LimitedReadingField[];
} {
  const kept: TelemetryReading = { ...reading };
  const dropped: LimitedReadingField[] = [];
  for (const field of Object.keys(TELEMETRY_READING_LIMITS) as LimitedReadingField[]) {
    const value = kept[field];
    if (value === undefined) continue;
    const { min, max } = TELEMETRY_READING_LIMITS[field];
    if (!(value >= min && value <= max)) {
      delete kept[field];
      dropped.push(field);
    }
  }
  return { reading: kept, dropped };
}
