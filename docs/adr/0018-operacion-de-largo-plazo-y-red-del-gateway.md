# 0018. Operación de largo plazo: retención, réplica a la nube por outbox y red del gateway

- Estado: Aceptado — el bind por defecto lo reemplaza [0022](0022-gateway-expuesto-por-defecto.md)
- Fecha: 2026-10-25
- Autores: Gastón Molina

## Contexto

La Fase 4 dejó el gateway funcionando de punta a punta, pero pensado para una jornada de prueba. Para operar 24 h o más (RNF-O2) y sumar la capa Cloud (RF-O6) aparecieron cuatro problemas:

- Con 50 pulseras cada 3 s se guardan unas 1,4 M de lecturas por día. Sin una política, la tabla crece sin límite y las consultas por tiempo se degradan.
- La tesis prevé una réplica en la nube, pero el gateway tiene que seguir atendiendo sin WAN, y los cortes pueden durar horas.
- Detrás de Nginx, la API veía la IP del proxy en cada pedido. El rate limit (300/min, login 5/min, check-in 10/min) se compartía entre todos los clientes: un portal con mucho tráfico podía bloquear la consola.
- Mosquitto y la web solo escuchaban en loopback. En la prueba del 21/10, para que la pulsera real llegara al broker hubo que usar un puente temporal.

## Decisión

- **Retención por borrado en tandas.** `TelemetryRetentionService` borra las lecturas más viejas que `TELEMETRY_RETENTION_HOURS` (72 h por defecto) cada `TELEMETRY_RETENTION_INTERVAL_MINUTES`, en tandas de 5.000 filas para no bloquear la ingesta, y nunca lanza. Un índice `ix_readings_measured_at` hace que el borrado y la curva no recorran toda la tabla. La curva del paciente (`GET /api/tickets/:id/readings`) agrega en la base con `date_bin` (hasta 600 puntos), así que el tamaño de la respuesta no depende de la ventana.
- **Réplica por outbox transaccional local.** Los cambios de turnos y alertas se encolan en `sync_outbox` (`ticket.upsert`, `alert.upsert`) con el contrato ya minimizado (sin DNI) y se envían en tandas de hasta 100 a `CLOUD_SYNC_URL` con un token Bearer. Si falla, se reintenta con backoff exponencial (como máximo 5 min). Lo que ya se envió se purga a los 7 días. La nube deduplica por `gatewayId:id`. Sin `CLOUD_SYNC_URL`, el módulo queda apagado y no escribe nada. Cuando la nube no responde, el health pasa a `degraded` (nunca a `down`) y `GET /api/sync/status` (solo ADMIN) muestra los pendientes.
- **`TRUST_PROXY`** configurable con la semántica de Express. El compose del gateway lo fija en `1` (un salto, Nginx), así el throttler y los logs ven la IP real del cliente. Sin la variable, el comportamiento no cambia (desarrollo).
- **Exposición de red explícita.** `GATEWAY_MQTT_BIND` y `GATEWAY_HTTP_BIND` (loopback por defecto) publican Mosquitto y la web en la interfaz que corresponda (VLAN de wearables, VLAN del personal). `GATEWAY_EXTRA_CORS_ORIGINS` suma los orígenes de esas interfaces. La ACL por pulsera de ADR 0014 sigue siendo la barrera del broker.
- **Validación con números.** `pnpm perf:load` (carga y latencias) y `pnpm perf:stress` (más de 10.000 registros en la consola) miden con el mismo reloj del proceso y dejan un reporte JSON en `.perf/`. Son herramientas de prueba: para sembrar y limpiar acceden a PostgreSQL directamente, siempre sobre datos marcados (códigos `wb-NN-fe00NN`, motivo `Prueba de estrés (perf:stress)`). No se corren contra una instalación con pacientes reales.

## Alternativas consideradas

- **Particionar `telemetry_readings` por día** (o usar TimescaleDB): borrar una partición es más barato, pero suma migraciones complejas o una extensión que el gateway no necesita con el volumen actual. Se puede revisar si la retención crece a semanas.
- **Agregar en vez de borrar** (promedios por minuto): sirve para ver la historia larga, pero RF-D3 solo pide la curva de la estadía. Queda como backlog.
- **Replicar con la replicación lógica de PostgreSQL o con un broker MQTT bridge:** expone la base entera y no permite minimizar datos (Ley 25.326). Con el outbox, el contrato decide qué sale.
- **Enviar a la nube en línea** (en el mismo pedido): un corte de WAN demoraría o rompería el llamado. Se descartó: el gateway nunca espera a la nube.
- **Publicar Mosquitto en `0.0.0.0` siempre:** más simple, pero abre el broker a todas las VLAN. Se prefirió un bind explícito.

## Consecuencias

- El gateway opera días seguidos con la base acotada. La curva de 24 h con 28.800 lecturas responde en unos 20 ms.
- Un corte de WAN deja cambios en espera y el health lo muestra, pero ningún flujo local se detiene. Al volver la conexión, se envían en orden.
- La nube recibe datos minimizados: el turno con el nombre visible, nunca el DNI.
- La prueba de estrés encontró que la consola tardaba 7 a 12 s en dibujar miles de filas. La fila de triaje y Turnos pasaron a dibujarse por tandas de 50 (`incremental` / `vt-show-more`); los contadores siguen mostrando los totales.
- `TRUST_PROXY` mal configurado (más saltos que los reales) permitiría falsificar la IP con `X-Forwarded-For`. Por eso el compose lo fija en `1` y no se expone la API sin Nginx.
- Las herramientas de rendimiento escriben en la base con SQL. ADR 0017 sigue valiendo para la operación (recuperación por endpoints). Este es un permiso acotado a pruebas.
