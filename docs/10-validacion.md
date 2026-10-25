# 10 · Validación de rendimiento (Fase 5c)

Números para el capítulo 12 de la tesis: carga de pulseras, latencias de punta a punta y la consola con más de 10.000 registros. Las herramientas están en el repo y dejan un reporte JSON en `.perf/` (ignorado por Git), así cualquiera del equipo puede repetir la medición.

| Herramienta        | Qué mide                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `pnpm perf:load`   | N pulseras por MQTT QoS 1 → pérdida, lectura → WS, caída → alerta, `GET /api/tickets` y llamado → TV |
| `pnpm perf:stress` | 10.000 turnos + 24 h de lecturas en PostgreSQL → API, y con `--ui` el Backoffice en Chromium         |

Todo se mide con el reloj del mismo proceso, desde que la pulsera simulada arma la lectura hasta que el cliente WebSocket la recibe. Así no hace falta sincronizar NTP entre máquinas. Los datos son simulados (Ley 25.326): pulseras `wb-NN-fe00NN`, pacientes «Estrés NNNNN». Las dos herramientas los borran al terminar (`--keep` para dejarlos).

## Resultados (25/10/2026)

**Entorno:** contenedor Linux con 2 vCPU (Xeon 2,1 GHz) y 7 GB de RAM. Corrieron juntos la API Node 22 (build de producción, logs en `debug`), PostgreSQL 16, un broker MQTT en proceso (aedes), el simulador de las 7 pulseras del seed y Chromium. Es un piso: el gateway real (mini PC con Docker y Mosquitto) tiene más margen.

### Carga y latencias — `pnpm perf:load --duration=600 --falls=40 --calls=40`

50 pulseras cada 3 s durante 10 minutos, 40 caídas en pulseras distintas, 40 llamados y `GET /api/tickets` cada 500 ms, todo en simultáneo.

| Criterio                            | Objetivo       | Medido                                                                    |     |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------- | --- |
| Carga: 50 pulseras cada 3 s (QoS 1) | 0 % de pérdida | 10.043 confirmadas por el broker · 10.043 por WS · 10.043 guardadas → 0 % | ✅  |
| Lectura → `telemetry:reading`       | p95 < 500 ms   | p50 3 · p95 7 · p99 16 · máx 66 ms (n = 10.043)                           | ✅  |
| Caída → `alert:emergency` (RNF-O1)  | p95 < 500 ms   | p50 3 · p95 6 · p99 19 · máx 19 ms · 40/40 alertas                        | ✅  |
| `GET /api/tickets` bajo carga       | p95 < 50 ms    | p50 4,8 · p95 8,7 · p99 16 · máx 35,7 ms (n = 1.187)                      | ✅  |
| Llamado → `ticket:called` en la TV  | p95 < 100 ms   | p50 6 · p95 13 · p99 32 · máx 32 ms (n = 40)                              | ✅  |

- La latencia de la alerta se mide desde `detectedAt` (la hora de la pulsera) hasta que la recibe el cliente del personal. RNF-O1 pide ≤ 2 s desde el impacto. En la pulsera, una caída se confirma unos 2,5 s después del impacto (inmovilidad, `config.h`). Esa calibración es de 5d y no entra en estos números.
- El llamado se mide desde que sale el `POST /api/tickets/:id/call` hasta que llega el evento a una conexión de TV.
- La alerta se emite antes de guardarse. Por eso, reconocerla en los primeros milisegundos puede dar 404 (la herramienta reintenta). Una persona nunca llega tan rápido.

### Estrés de la consola — `pnpm perf:stress --ui=<backoffice>`

10.000 turnos en el día (1.500 en espera, 1.500 llamados o en atención, el resto cerrados) y una pulsera con 24 h de lecturas cada 3 s (28.800). El Backoffice se midió en su build de producción, servido como lo sirve Nginx.

| Criterio                                    | Objetivo                    | Medido                                       |     |
| ------------------------------------------- | --------------------------- | -------------------------------------------- | --- |
| `GET /api/tickets` (fila abierta)           | p95 < 200 ms                | p50 106 · p95 139 ms · 3.015 filas · 1,4 MB  | ✅  |
| Día completo (Turnos, todos los estados)    | p95 < 1000 ms               | p50 320 · p95 393 ms · 10.021 filas · 4,6 MB | ✅  |
| Curva de 24 h (28.800 lecturas)             | p95 < 300 ms                | p50 24 · p95 32 ms · 600 puntos · 72 KB      | ✅  |
| Backoffice: fila de triaje                  | < 2 s                       | 755 ms                                       | ✅  |
| Backoffice: Turnos del día                  | < 2 s                       | 1.646 ms                                     | ✅  |
| Backoffice: curva de 24 h (abrir + dibujar) | < 2 s                       | 865 ms                                       | ✅  |
| Backoffice sin Internet (RNF-O2)            | 0 pedidos fuera del gateway | 0                                            | ✅  |

**Lo que encontró la prueba:** la primera corrida dibujaba todas las filas. Con 1.500 en espera y 10.000 en Turnos, la consola tardaba 7,0 s y 11,9 s en mostrarse (servidor de desarrollo). Ahora las listas largas se dibujan por tandas de 50 con «Mostrar más» (`incremental` / `vt-show-more` del Backoffice). Los contadores siguen mostrando los totales y las tandas que ya abriste no se pierden cuando llega una lectura. La API no se tocó: la curva ya agregaba en la base (`date_bin`) y la fila de 3.000 turnos responde en menos de 150 ms.

## Cómo repetirlo

Contra el stack nativo de desarrollo (API, PostgreSQL y un broker sin ACL), con el `.env` de la raíz:

```bash
pnpm nx serve api                     # o node dist/apps/api/main.js después de pnpm nx build api
pnpm perf:load                        # 50 pulseras · 3 s · 120 s (≈ 2 min)
pnpm perf:load --duration=600 --falls=40 --calls=40
pnpm nx build backoffice              # para medir la UI en producción, servida detrás de un proxy /api
pnpm perf:stress --ui=http://localhost:4200 [--chromium=/ruta/a/chromium]
pnpm perf:stress --cleanup            # solo si una corrida se cortó y dejó datos
```

Opciones de `perf:load`: `--count` (hasta 90), `--interval`, `--duration`, `--falls`, `--calls`, `--rest-every`, `--api`, `--mqtt`, `--mqtt-user`/`--mqtt-pass`, `--key`, `--db` y `--keep`. Sin `DATABASE_URL`, la pérdida se calcula contra lo recibido por WebSocket. El código de salida es distinto de 0 si algún criterio no se cumple.

- **Contra el gateway Docker:** la API entra por Nginx (`--api=http://localhost:8080`), pero el broker exige una cuenta y una ACL por pulsera (ADR 0014) y PostgreSQL no se publica. Para cargar el gateway, usá el simulador aprovisionado (`pnpm sim:wearables --gateway`). Los números de este documento son del stack nativo.
- **Rate limit:** la prueba hace unos 130 pedidos por minuto desde una IP, por debajo del límite global de 300. No bajes `--rest-every` de 300 ms.

## Prueba de 24 h sin WAN (RNF-O2) — procedimiento para el equipo

Esta prueba se hace en el gateway real, porque necesita la red del hospital. Mide continuidad, no latencia.

1. En `.gateway/.env`, configurá `CLOUD_SYNC_URL` apuntando a `pnpm cloud:sink` en otra máquina (la «nube»), `TELEMETRY_RETENTION_HOURS=72` y `GATEWAY_MQTT_BIND` en la VLAN de wearables. Después, `pnpm gateway:up` y `pnpm gateway:verify`.
2. Dejá corriendo `pnpm sim:wearables --gateway --duration=90000` (las 7 pulseras del seed, 25 h) y, si está lista, la pulsera física.
3. Cortá el enlace WAN del router (el uplink, no la LAN). Anotá la hora.
4. Durante las 24 h, cada tanto: check-in desde el portal, asignar una pulsera, inyectar una caída (`--inject=fall:3@…`), reconocerla, llamar desde el Backoffice y verlo en la TV y en el OLED. Registrá `curl -s localhost:8080/api/health` cada 15 min (el check `sync` tiene que estar en `degraded` con los pendientes en aumento, y `database`/`mqtt` en `ok`).
5. Reconectá la WAN. En menos de 5 min (el backoff máximo), `GET /api/sync/status` tiene que mostrar `pending: 0`, y `.cloud-sink/events.jsonl` tiene que tener todos los turnos y alertas, sin DNI.
6. Criterios: ningún flujo local falló, `sync` volvió a `ok`, no se perdió ningún cambio en la nube y la tabla de lecturas no superó lo que permite la retención.

Volcá en este documento la fecha, el hardware, la duración real del corte y los pendientes máximos.
