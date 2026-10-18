import { parseWearableCode } from './wearable-id';

/** Archivo local de contraseñas por pulsera. El usuario MQTT es siempre su código. No versionar. */
export type WearableMqttPasswords = Readonly<Record<string, string>>;

/** Evita entradas ambiguas al convertir credenciales al formato usuario:contraseña de Mosquitto. */
export function isMqttPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 128 &&
    !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === ':')
  );
}

/** Valida configuración compartida por el aprovisionador y el simulador sin revelar secretos. */
export function parseWearableMqttPasswords(value: unknown): WearableMqttPasswords {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El archivo MQTT debe ser un objeto de códigos y contraseñas');
  }
  const result: Record<string, string> = {};
  for (const [code, password] of Object.entries(value)) {
    if (!parseWearableCode(code)) throw new Error('Código de pulsera inválido en el archivo MQTT');
    if (!isMqttPassword(password))
      throw new Error('Contraseña MQTT inválida (16–128 caracteres, sin controles ni dos puntos)');
    result[code] = password;
  }
  return result;
}
