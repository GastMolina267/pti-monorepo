# 09 · Despliegue local del gateway (Fases 4a–4b)

El gateway corre la API, PostgreSQL, Mosquitto y Nginx con los builds de Backoffice y TV. No necesita portal cautivo, router especial ni wearable físico. [ADR 0013](adr/0013-despliegue-software-gateway.md).

## Requisitos y arranque

Docker Desktop con el motor Linux iniciado, Node 24 y pnpm 10. Desde la raíz:

```bash
pnpm install --frozen-lockfile
pnpm gateway:init
pnpm gateway:up
pnpm gateway:smoke
```

`gateway:up` también ejecuta el inicializador y prepara los usuarios MQTT. Recrea los contenedores para aplicar cambios de credenciales y ACL: hay una interrupción breve, pero los volúmenes se conservan. La primera construcción necesita internet para bajar imágenes y dependencias; el sistema desplegado usa fuentes y recursos locales. Esto no acredita todavía la prueba de 24 h sin WAN de la Fase 5.

- Backoffice: <http://localhost:8080>.
- TV: <http://localhost:8081>.
- Health a través de ambos proxies: `/api/health`.
- Broker para simuladores locales: `mqtt://localhost:1884`.

Los puertos se publican solo en loopback. PostgreSQL y la API no publican puertos al host; se accede a la API mediante Nginx. El `docker-compose.yml` de desarrollo sigue disponible sin cambios, con volúmenes y nombres separados.

## Configuración y credenciales

`pnpm gateway:init` genera `.gateway/.env`, ignorado por Git y por el contexto Docker. Contiene contraseñas aleatorias de PostgreSQL y del seed, secreto JWT, clave AES y puertos. No imprime los secretos ni sobrescribe un archivo existente.

Podés editar `GATEWAY_HTTP_PORT`, `GATEWAY_TV_PORT` y `GATEWAY_MQTT_PORT` antes de levantar el stack. Las URLs CORS se calculan con esos puertos. Si cambiás la contraseña de PostgreSQL después de inicializar su volumen, tenés que cambiarla también en la base: el entorno del contenedor no rota una contraseña existente.

Los targets de Compose cargan explícitamente `.gateway/.env` por encima del entorno heredado de Nx. Así, un `.env` de desarrollo con contraseñas distintas o usuarios MQTT vacíos no reemplaza las credenciales del despliegue.

## Seguridad MQTT (4b)

El broker del gateway rechaza conexiones anónimas. `pnpm gateway:mqtt-config` agrega dos cuentas de servicio a `.gateway/.env` y prepara `.gateway/mqtt/`, sin cambiar contraseñas existentes de PostgreSQL, JWT, AES, seed o dispositivos. [ADR 0014](adr/0014-identidades-y-acl-mqtt.md).

- API (`vitalia-api`): lee `hospital/+/wearable/+/data` y publica `hospital/+/wearable/+/cmd`.
- Health (`vitalia-health`): solo lee `$SYS/broker/uptime`.
- Cada pulsera usa su código como usuario: publica su propio `.../data` y lee su propio `.../cmd`, en cualquier sala. No puede leer telemetría ni escribir comandos.

El contrato local `WearableMqttPasswords` es un JSON `{ "<código>": "<contraseña>" }`, validado por `parseWearableMqttPasswords` en `@vitalia/contracts`. Las contraseñas tienen 16–128 caracteres, sin controles ni `:`. El archivo real `.gateway/mqtt/devices.json` contiene secretos; no lo compartas ni lo versiones. El aprovisionador genera claves aleatorias de 32 caracteres y prepara las ocho pulseras del seed solo en la primera ejecución.

El servicio temporal `mqtt-init` convierte `.gateway/mqtt/users` a hashes con `mosquitto_passwd`; el broker solo monta el volumen de hashes y ACL, en modo lectura. Los archivos locales en claro siguen siendo necesarios para aprovisionar clientes y deben protegerse como `.env` (en Windows, con los permisos de la cuenta). No se usa un patrón global que dé permisos de pulsera a las cuentas de servicio.

```bash
pnpm gateway:mqtt-check
pnpm sim:wearables --gateway --count=2 --duration=10
# Alta adicional, independiente del alta funcional en la API:
pnpm gateway:mqtt-config --wearable=wb-09-5e0009
pnpm gateway:up
```

Para revocar una pulsera, eliminá su entrada de `devices.json` y ejecutá `gateway:up`: no se recrea automáticamente. Para rotar su contraseña, reemplazala en ese archivo y recreá el stack. Actualizá también el cliente correspondiente. El simulador falla antes de conectar si falta alguna identidad solicitada. El alta MQTT no crea una pulsera en la base: para recibir lecturas debe existir también en la API.

`--gateway` toma la clave AES, el puerto y las identidades del despliegue, sin reutilizar las credenciales de la API. `--credentials=RUTA` o `MQTT_CREDENTIALS_FILE` permiten otro archivo; sin esos parámetros sigue disponible el simulador del entorno dev. El Compose de desarrollo mantiene su broker anónimo y separado.

El simulador se ejecuta mediante Nx. Para su ayuda usá `pnpm sim:wearables --args=--help`; para opciones que Nx reserva, pasá todo junto, por ejemplo `pnpm sim:wearables --args="--gateway --count=2 --duration=10 --verbose"`.

`gateway:mqtt-check` necesita las pulseras simuladas 02 y 03 aprovisionadas. Comprueba CONNACK de rechazo a anónimos/contraseña incorrecta, entregas permitidas, aislamiento real incluso con una suscripción `hospital/#` y PUBACK `0x87` ante escrituras prohibidas. Usa una sala aleatoria, comandos de prueba y sobres inválidos que la API descarta sin persistir. La ejecución no requiere hardware. MQTT sigue usando TCP local, sin TLS: para salir de loopback o desplegar en una red compartida hay que definir transporte y protección de las credenciales. Esta fase no acredita ese despliegue de red.

## Migraciones y datos simulados

La API aplica las migraciones registradas al arrancar (`DB_RUN_MIGRATIONS=true`, siempre `synchronize=false`). El Dockerfile agrega `seed.js` como entry point de Webpack para reutilizar el seed existente sin incluir TypeScript ni tsx en la imagen final.

Webpack genera el manifiesto y lockfile de producción. `tslib` se declara como dependencia de ejecución y, junto con `pg`, en `runtimeDependencies` del plugin: el primero lo inserta el compilador y el segundo lo carga TypeORM dinámicamente, por lo que no alcanzaba con detectar imports del dominio.

El seed nunca corre automáticamente:

```bash
pnpm gateway:seed
```

Ese comando habilita explícitamente `SEED_ALLOW_PRODUCTION=true` solo en el contenedor temporal del seed. La aplicación sigue ejecutándose con configuración de producción. Los usuarios son `admin@vitalia.local`, `enfermeria@vitalia.local`, `medico@vitalia.local`, `pediatria@vitalia.local` y `recepcion@vitalia.local`; la contraseña está en `SEED_PASSWORD` de `.gateway/.env`. Todos los datos son simulados.

## Verificación y parada

```bash
pnpm nx run api:gateway-test
pnpm gateway:smoke
pnpm gateway:mqtt-check
pnpm affected
pnpm gateway:down
```

El smoke exige ambos HTML, fallback de rutas SPA, health `ok` (base y broker), endpoint de últimos llamados y handshake de Socket.IO a través de Nginx por WebSocket y polling. No modifica datos y no reemplaza el E2E clínico de 4d.

`gateway:down` conserva los volúmenes. Volvé a ejecutar `gateway:up` para recuperar los datos. Para inspeccionar el estado o logs sin imprimir la configuración con secretos:

```bash
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml ps
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml logs --tail=100 api web
```

Las imágenes finales no incluyen fuentes TypeScript, dependencias de desarrollo ni secretos del host. La API corre como usuario `node`; Nginx sirve cada app en su propio origen para conservar sus rutas absolutas y sus servicios Socket.IO sin modificar la UI.
