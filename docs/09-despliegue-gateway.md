# 09 · Despliegue local, operación y demo (Fases 4a–4e)

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

- Backoffice: <http://localhost:8080> (desde otro dispositivo, `http://<IP del gateway>:8080`).
- TV: <http://localhost:8081>.
- Health a través de ambos proxies: `/api/health`.
- Broker para pulseras y simuladores: `mqtt://<IP del gateway>:1884` (`mqtt://localhost:1884` desde la misma máquina).

Los puertos se publican en todas las interfaces de la máquina ([ADR 0022](adr/0022-gateway-expuesto-por-defecto.md)): el gateway corre en una red privada propia y las pulseras, la TV y la consola llegan sin configurar nada. En una red compartida, restringilos con `GATEWAY_MQTT_BIND`/`GATEWAY_HTTP_BIND` (más abajo). PostgreSQL y la API no publican puertos al host; se accede a la API mediante Nginx. El `docker-compose.yml` de desarrollo sigue disponible sin cambios, con volúmenes y nombres separados.

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

`gateway:mqtt-check` necesita las pulseras simuladas 02 y 03 aprovisionadas. Comprueba CONNACK de rechazo a anónimos/contraseña incorrecta, entregas permitidas, aislamiento real incluso con una suscripción `hospital/#` y PUBACK `0x87` ante escrituras prohibidas. Usa una sala aleatoria, comandos de prueba y sobres inválidos que la API descarta sin persistir. La ejecución no requiere hardware. MQTT sigue usando TCP sin TLS: la barrera son las credenciales y la ACL por pulsera. Publicado en la red, el gateway supone una red privada propia (ADR 0022); para una red compartida hay que restringir el bind y definir transporte y protección de las credenciales. Esta fase no acredita ese despliegue de red.

## Migraciones y datos simulados

La API aplica las migraciones registradas al arrancar (`DB_RUN_MIGRATIONS=true`, siempre `synchronize=false`). El Dockerfile agrega `seed.js` como entry point de Webpack para reutilizar el seed existente sin incluir TypeScript ni tsx en la imagen final.

Webpack genera el manifiesto y lockfile de producción. `tslib` se declara como dependencia de ejecución y, junto con `pg`, en `runtimeDependencies` del plugin: el primero lo inserta el compilador y el segundo lo carga TypeORM dinámicamente, por lo que no alcanzaba con detectar imports del dominio.

El seed nunca corre automáticamente:

```bash
pnpm gateway:seed
```

Ese comando habilita explícitamente `SEED_ALLOW_PRODUCTION=true` solo en el contenedor temporal del seed. La aplicación sigue ejecutándose con configuración de producción. Los usuarios son `admin@vitalia.local`, `enfermeria@vitalia.local`, `medico@vitalia.local`, `pediatria@vitalia.local` y `recepcion@vitalia.local`; la contraseña está en `SEED_PASSWORD` de `.gateway/.env`. Todos los datos son simulados.

## Firmware sin placa (4c)

Desde la raíz, con Docker Desktop iniciado:

```bash
pnpm nx run wearable-firmware-poc:pio-check-docker
```

El target construye `Dockerfile.check` del firmware con Python 3.12 y PlatformIO 6.1.19: tests native de las libs puras y del adaptador MQTT, build ESP32-C3 y compilación de los tests de cifrado de placa sin subirlos ni ejecutarlos. Solo usa `secrets.h.example`; `.dockerignore` excluye los secretos reales. La primera ejecución descarga el compilador y las bibliotecas fijadas en `platformio.ini`. El target `pio-toolchain-docker` permite preparar únicamente las herramientas.

Validación local de 4c (18/10): 43 tests nativos pasaron, incluido el adaptador MQTT de producción con stubs de SDK; firmware ESP32-C3 y tests de cifrado de placa compilados. La compilación de estos últimos no acredita haber ejecutado los vectores en hardware.

Si ya tenés PlatformIO y GCC en el PATH, siguen disponibles `pnpm fw:test` y `pnpm fw:build`. Los targets `pio-*` son explícitos: `pnpm affected` no obliga a instalar herramientas de firmware en todas las máquinas. CI conserva el job de firmware con las mismas pruebas nativas, compilación real y compilación de tests de placa.

La recepción del llamado usa el contrato documentado en [04-contratos.md](04-contratos.md#comando-al-wearable-wearablecommand): identidad propia, resuscripción, validación, fragmentos y cola hacia el OLED. Conserva el último llamado en RAM y señala pérdida de red; no recupera comandos emitidos mientras estaba desconectado. El recorrido API → broker → cliente de prueba se completa en 4d. Esta validación no acredita pantalla física, sensores, flasheo ni calibración.

## Recorrido integrado sobre Docker (4d)

En una instalación nueva, levantá el gateway y ejecutá el seed explícito como se indica arriba. Con ese stack en funcionamiento:

```bash
pnpm gateway:e2e-install
pnpm nx run api:gateway-e2e-typecheck
pnpm gateway:e2e
```

`gateway:e2e-install` descarga Chromium una sola vez. En Linux/CI usá `pnpm nx run api:gateway-e2e-install:ci` para instalar también las dependencias del sistema. Los tests de `tools/gateway-e2e/` usan los puertos y la contraseña del seed de `.gateway/.env`, con dos contextos de navegador aislados; no necesitan portal, router ni placa.

El recorrido verifica login, check-in por API, asignación desde Backoffice, lectura cifrada por MQTT y persistencia visible, caída, reconocimiento desde UI, llamado desde UI → TV y `SHOW_TICKET` en el cliente MQTT. Después corta las conexiones de ambos navegadores, reconoce una alerta desde otro cliente, publica hipoxia y otra lectura, llama otro turno y vuelve a conectar. Exige que fila, signos vitales, alertas y TV recuperen los cambios sin recargar. Incluye un corte/reconexión del cliente MQTT antes del segundo comando.

Necesitás al menos una pulsera simulada 02–08 aprovisionada, libre, sin emisor externo ni alertas activas. El test no usa la pulsera física 01. La sala `e2e-4d` queda reservada para estas pruebas; una pulsera libre cuya última lectura pertenece a esa sala puede reutilizarse inmediatamente. No ejecutes dos recorridos sobre el mismo stack al mismo tiempo.

Cada corrida crea dos pacientes/turnos **simulados y sin DNI**, marcados en el motivo como `E2E simulado 4e: <UUID>:` (las corridas anteriores conservan el marcador 4d). Al terminar reconoce sus alertas y cierra sus turnos, liberando la pulsera; no borra la base ni resetea el seed. El historial y las lecturas quedan disponibles como evidencia de prueba. Las capturas de fallos quedan bajo `.gateway/e2e-results`; no se guardan trazas, JWT ni sesiones de login en archivos. No compartas la configuración local.

La limpieza corre en `finally`. Desde 4e se escribe un diario en `.gateway/runs/<UUID>.json` antes del primer check-in; si el proceso se interrumpe, usá la recuperación por corrida explicada abajo. Los diarios solo contienen IDs y fechas.

El E2E detectó y motivó la corrección de alertas reconocidas durante un corte que seguían visibles por la heurística de frescura. Las regresiones cubren también eventos durante una consulta y respuestas atrasadas que intentan restaurar alertas reconocidas. [ADR 0016](adr/0016-validar-gateway-con-navegadores-reales.md).

Esta prueba usa el despliegue real y un cliente MQTT de prueba; no ejecuta el firmware en hardware ni acredita una caída de WAN, la prueba de 24 h o los objetivos de carga y latencia de Fase 5.

Validación local (18/10): recorrido de ocho pasos en verde sobre el gateway reconstruido, 30 tests del Backoffice y 16 tareas afectadas en siete proyectos. Smoke y seguridad MQTT volvieron a pasar después del E2E. El job CI está configurado; falta acreditar su ejecución remota.

## Verificación y parada

```bash
pnpm gateway:verify
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

## Operación y demo reproducible (4e)

### Primera ejecución desde una copia limpia

Con Docker Desktop iniciado, desde la raíz de la copia, ejecutá en este orden:

```bash
pnpm install --frozen-lockfile
pnpm gateway:up
pnpm gateway:seed
pnpm gateway:e2e-install
pnpm gateway:verify
pnpm gateway:demo
```

`gateway:verify` ejecuta secuencialmente tests operativos unitarios, typecheck E2E, smoke, autenticación/ACL MQTT y recorrido E2E. Corta en el primer fallo y Nx muestra la tarea que falló. Necesita un stack levantado y sembrado; no hace seed ni reinicia servicios. Para acreditar además el código del monorepo, ejecutá `pnpm affected`.

El seed es para una instalación simulada inicial. Para repetir una demo usá directamente `gateway:demo`, sin resetear la base. Detené otros simuladores durante la demo y los checks; necesitás una pulsera simulada libre. Cada corrida mantiene su historial y limpia únicamente sus recursos. Las pantallas, claves y puertos se toman de la misma instalación local.

### Guion para presentar

`gateway:demo` abre dos ventanas nuevas de Chromium (Backoffice y TV), realiza el mismo recorrido probado en 4d, ralentiza las acciones y pausa cinco segundos en los puntos de observación. La terminal muestra `DEMO · ...` en cada pausa y el UUID recuperable. Se ejecuta sola: evitá intervenir en esas ventanas mientras avanza.

1. **Ingreso y asignación:** mostrar el turno creado por API y su pulsera asignada desde la UI. Solo pacientes ficticios, sin DNI.
2. **Lectura:** observar 77 lpm y SpO₂ 98 % en triaje. La lectura recorrió cifrado AES-GCM, Mosquitto, API y PostgreSQL.
3. **Caída simulada:** mostrar aviso crítico y alarma, reconocimiento desde Backoffice y triaje crítico que se conserva.
4. **Llamado y cierre:** observar código/consultorio en la TV y recepción del comando MQTT; luego finalizar la atención y liberar la pulsera.
5. **Corte de los clientes:** mantener las pantallas con su último estado mientras otro cliente reconoce una alerta y el gateway recibe hipoxia, nueva lectura y llamado.
6. **Reconexión:** recuperar el estado sin recargar; reconocer la nueva alerta y cerrar los recursos propios al finalizar.

La TV muestra información pública. El cliente MQTT confirma `SHOW_TICKET`; no representa una pantalla física. Las ventanas se cierran al terminar. Para comprobar el guion sin abrir ventanas: `pnpm nx run api:gateway-demo:ci`. Esta variante conserva las pausas y las mismas aserciones.

### Reinicios y prueba operativa

```bash
pnpm gateway:operations
pnpm gateway:smoke
```

Este comando **interrumpe brevemente el stack local**. Usalo fuera de una demo: crea fixtures propios, hace `down` y recrea sin borrar volúmenes, exige conservar turno/asignación/última lectura y configuración byte a byte, comprueba reconexión de Backoffice/TV sin recarga y reutiliza el JWT anterior. Reinicia también Mosquitto, exige una nueva lectura/alerta y un llamado en TV con comando MQTT. Finalmente simula una respuesta de check-in perdida, recupera la corrida dos veces y verifica que los otros turnos abiertos no cambien. Crea un respaldo y lo restaura en PostgreSQL temporal aislado; deja el gateway funcionando y conserva el respaldo local.

E2E, demo, recuperación y creación de respaldo usan `.gateway/operation.lock` para impedir operaciones simultáneas entre esos comandos. No ejecutes `gateway:up`, `gateway:down`, seed o simuladores mientras corren. Si un proceso fue terminado abruptamente, comprobá que el PID del archivo ya no esté activo y eliminá **solo** `.gateway/operation.lock` antes de recuperar. Nunca borres `.gateway/.env` para resolver un bloqueo.

### Recuperar una demo interrumpida

1. Detené el proceso de la demo o E2E y cualquier simulador. Si quedó un bloqueo de un proceso terminado, retiralo como se indicó arriba.
2. Recuperá el servicio con `pnpm gateway:up` y `pnpm gateway:smoke`, conservando configuración y volúmenes.
3. Listá las corridas y elegí el UUID indicado por la terminal de la demo:

```bash
pnpm gateway:recover
pnpm gateway:recover --run=<UUID>
```

El comando localiza por marcador los turnos de esa corrida mediante una consulta de solo lectura a PostgreSQL, incluso si son de otro día o el servidor creó el turno antes de que se guardara su ID en el diario. Comprueba el marcador de **todos** los turnos antes de mutar; reconoce sus alertas activas y lleva los turnos a `DONE` o `CANCELLED` mediante la API, liberando la pulsera. Es idempotente y conserva pacientes, lecturas e historial. No hace un barrido de todos los pacientes simulados ni toca fixtures antiguos de 4d. Esos casos anteriores requieren revisión manual.

### Respaldo y ensayo de restauración

Sin demos ni simuladores activos:

```bash
pnpm gateway:backup
pnpm gateway:backup-check --backup=".gateway/backups/<carpeta-informada>"
```

El respaldo crea un directorio nuevo: `database.dump` (snapshot consistente de `pg_dump` custom), `.env`, `mqtt/devices.json`, `mqtt/users`, `mqtt/acl`, diarios disponibles y `manifest.json` con SHA-256, fecha, revisión Git (si está disponible) y `workingTreeDirty` para señalar cambios sin commit. Si los archivos copiados cambian durante el dump, falla y no genera un manifiesto válido. Un directorio sin manifiesto o con hashes distintos no es un respaldo válido.

El bundle contiene **secretos en claro y datos de la base**. Se guarda bajo `.gateway/`, excluido de Git y Docker. Conservá una copia con acceso restringido fuera del disco de trabajo; para transportarla, usá almacenamiento cifrado. La copia de la base necesita su configuración original: regenerar AES, contraseñas o identidades MQTT rompe la continuidad de la instalación.

`backup-check` valida todos los hashes y restaura el dump completo en un contenedor `postgres:16-alpine` temporal, sin red, puertos ni volumen del gateway. Ejecuta `pg_restore` en una transacción, consulta las tablas principales y migraciones, e informa solamente conteos. El contenedor y su almacenamiento efímero se eliminan en `finally`. No cambia la base original ni acredita una restauración del gateway en otra máquina; sí comprueba que el dump se puede restaurar con su esquema y datos.

### Restauración real ante pérdida de datos

Este procedimiento reemplaza el contenido de la base seleccionada por el respaldo. Ejecutalo únicamente cuando hayas decidido recuperar ese punto en el tiempo. Primero validá el bundle con `backup-check` y guardá un respaldo del estado actual si sigue accesible.

1. Detené emisores y ejecutá `gateway:down`, conservando los volúmenes. Usá una copia del repositorio correspondiente a la revisión del manifiesto. Si el respaldo se tomó con cambios sin commit, necesitás también esas fuentes.
2. Copiá del bundle `.env`, `mqtt/` y `runs/` (si existe) a `.gateway/`, conservando una copia aparte de la configuración actual. En una máquina nueva deben copiarse **antes** del primer `gateway:up`; no ejecutes el seed.
3. Si conservás un volumen PostgreSQL existente, la contraseña del rol debe coincidir con la de la configuración recuperada. Restaurar `.env` no rota la contraseña del rol. Si es un volumen de la misma instalación y no se rotaron claves, ya coincide.
4. Ejecutá `gateway:up`, detené API/web, copiá el dump al contenedor y restaurá. En estos comandos reemplazá `<respaldo>` por la ruta real:

```bash
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml stop api web
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml cp "<respaldo>/database.dump" postgres:/tmp/vitalia-restore.dump
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml exec -T postgres pg_restore -U vitalia -d vitalia --clean --if-exists --exit-on-error --single-transaction --no-owner --no-privileges /tmp/vitalia-restore.dump
docker compose --env-file .gateway/.env -f docker-compose.gateway.yml exec -T postgres rm -f /tmp/vitalia-restore.dump
pnpm gateway:up
pnpm gateway:verify
```

Si `pg_restore` falla, la transacción revierte: mantené API/web detenidos y revisá versión del repositorio, PostgreSQL y respaldo antes de intentar de nuevo. Tras recuperar, el comando `gateway:recover` permite limpiar una corrida pendiente incluida en los diarios. El respaldo no incluye mensajes pendientes del broker ni imágenes Docker: los mensajes perdidos durante cortes prolongados corresponden al trabajo de resiliencia de Fase 5.

### Diagnóstico breve

- **Docker no responde:** iniciá Docker Desktop con motor Linux y repetí `gateway:up`.
- **Puerto ocupado:** detené la otra instalación o ajustá los tres puertos en `.gateway/.env` y recreá. No reemplaces secretos.
- **Health degradado:** inspeccioná `ps` y `logs --tail=100 api mosquitto postgres`; `gateway:smoke` exige base y broker saludables.
- **Login rechazado:** verificá que se haya ejecutado el seed inicial y que estés usando el `SEED_PASSWORD` de esta instalación, no el `.env` de desarrollo. Respetá el límite de cinco intentos por minuto.
- **No hay pulsera disponible:** detené emisores, recuperá la corrida pendiente y revisá asignaciones/alertas desde Backoffice. Evitá ejecutar demos en paralelo.
- **Respaldo inválido:** conservá el directorio para diagnóstico y generá otro; no edites hashes para hacer pasar el check.

CI ejecuta `gateway:verify`, `gateway:operations` y smoke final sobre una instalación nueva. Los respaldos, configuración, diarios y capturas permanecen locales al job; no se publican como artifacts. Carga, latencias y estrés se midieron en la Fase 5c ([10-validacion.md](10-validacion.md)) y la réplica a la nube se implementó en la 5b (más abajo). Quedan pendientes la prueba de 24 h sin WAN, con su procedimiento en 10-validacion, y la validación con hardware.

## Operación de largo plazo y red (5b)

Decisiones en [ADR 0018](adr/0018-operacion-de-largo-plazo-y-red-del-gateway.md). Todas las variables van en `.gateway/.env` y se aplican con `pnpm gateway:up`.

| Variable                              | Por defecto     | Para qué                                                                                                                                                |
| ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATEWAY_MQTT_BIND`                   | `0.0.0.0`       | Interfaz donde escucha Mosquitto. Para restringirlo, la IP del gateway en la VLAN de wearables (ej. `10.0.20.1`).                                       |
| `GATEWAY_HTTP_BIND`                   | `0.0.0.0`       | Interfaz de Backoffice y TV. Para restringirlas, la IP de la VLAN del personal / de las pantallas; `127.0.0.1` solo esta máquina.                       |
| `GATEWAY_EXTRA_CORS_ORIGINS`          | —               | Orígenes extra separados por coma. Backoffice y TV llaman a la API en su mismo origen, así que solo hace falta para un cliente servido desde otro lado. |
| `TELEMETRY_RETENTION_HOURS`           | `72`            | Antigüedad máxima de las lecturas. El borrado corre cada hora, en tandas de 5.000.                                                                      |
| `GATEWAY_ID`                          | `gateway-local` | Nombre del gateway en la nube (la nube deduplica por `GATEWAY_ID` + id del cambio).                                                                     |
| `CLOUD_SYNC_URL` / `CLOUD_SYNC_TOKEN` | —               | Réplica a la nube (RF-O6). Vacío = apagada. Con valor, turnos y alertas se encolan y se envían con backoff.                                             |

La API corre con `TRUST_PROXY=1` (fijo en el compose), así el rate limit cuenta por cliente y no por Nginx. No publiques el puerto de la API sin Nginx delante.

La pulsera real se conecta directo al broker publicado (demo del 26/10), sin el puente temporal de la prueba del 21/10. Las herramientas (`gateway:smoke`, `gateway:recover`, `gateway:e2e`, `sim:wearables --gateway`) usan la IP del bind cuando es puntual, y `localhost` si no. La ACL por pulsera (4b) sigue exigiendo usuario y contraseña propios.

### Réplica a la nube y cortes de WAN

```bash
pnpm cloud:sink --token=prueba            # nube de prueba en :4900/ingest → .cloud-sink/events.jsonl
# .gateway/.env: CLOUD_SYNC_URL=http://<ip-del-host>:4900/ingest  CLOUD_SYNC_TOKEN=prueba
curl -s localhost:8080/api/health | jq '.checks[] | select(.name=="sync")'
```

Si cortás la nube (Ctrl+C en `cloud:sink`), el health pasa a `degraded` con «N cambio(s) en espera» y los turnos y alertas siguen funcionando. Cuando la volvés a levantar, los pendientes se envían en orden. Con sesión de ADMIN, `GET /api/sync/status` muestra los pendientes, el último error y el próximo intento.

## Validación de rendimiento (5c)

Procedimiento y resultados en [10-validacion.md](10-validacion.md): `pnpm perf:load` (50 pulseras, latencias) y `pnpm perf:stress` (más de 10.000 registros en la consola).
