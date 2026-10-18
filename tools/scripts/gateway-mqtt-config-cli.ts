import { configureGatewayMqtt } from './gateway-mqtt-config';

try {
  const codes = process.argv
    .slice(2)
    .filter((arg) => arg !== '--')
    .map((arg) => {
      if (!arg.startsWith('--wearable='))
        throw new Error('Única opción: --wearable=wb-<NN>-<mac> (repetible)');
      return arg.slice('--wearable='.length);
    });
  console.log(
    `Configuración MQTT preparada: ${configureGatewayMqtt('.gateway', codes)} pulseras; secretos conservados en .gateway/`,
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : 'No se pudo configurar MQTT');
  process.exitCode = 1;
}
