# 0022. Gateway publicado en la red por defecto

- Estado: Aceptado
- Fecha: 2026-10-26
- Autores: Facundo Gomez Geneiro
- Reemplaza en parte a: [0018](0018-operacion-de-largo-plazo-y-red-del-gateway.md) (solo el bind por defecto de "Exposición de red explícita")

## Contexto

ADR 0018 dejó Mosquitto, Backoffice y TV en loopback por defecto (`GATEWAY_MQTT_BIND`/`GATEWAY_HTTP_BIND` = `127.0.0.1`) y descartó `0.0.0.0` porque abría el broker a todas las VLAN.

En la práctica, el gateway no corre en la red de la universidad ni en una red compartida, sino en **una red privada propia del equipo**. Ahí todo lo que importa vive del otro lado de la red: la pulsera, la TV, la consola en otra PC y la app del paciente en un teléfono. Con loopback, cada prueba con hardware exigía editar `.gateway/.env` con la IP de la notebook. Esa IP cambia con el DHCP, así que también había que sumar orígenes CORS. En la demo del 26/10 además aparecieron herramientas (`gateway:smoke` y otras) con `localhost` fijo, que fallan cuando el bind es una IP puntual.

## Decisión

- **`0.0.0.0` por defecto** en `GATEWAY_MQTT_BIND` y `GATEWAY_HTTP_BIND`: el broker (1884), el Backoffice (8080) y la TV (8081) quedan publicados en todas las interfaces.
- **Las variables siguen** para restringir: una IP puntual publica solo en esa interfaz (la VLAN de las pulseras, la del personal), y `127.0.0.1` vuelve al comportamiento anterior.
- PostgreSQL y la API siguen sin publicar puertos: a la API solo se llega por Nginx.
- **Sin CORS extra para la LAN:** Backoffice y TV llaman a `/api` y `/socket.io` en su mismo origen, a través de Nginx. `GATEWAY_EXTRA_CORS_ORIGINS` queda para un cliente servido desde otro origen.
- **Las herramientas siguen al bind** (`gatewayHost()`, en `tools/wearable-simulator/src/lib/gateway-host.ts`): con una IP puntual se conectan a esa IP, y con `0.0.0.0` o loopback, a `localhost`.

## Alternativas consideradas

- **Mantener loopback y documentar el bind:** es lo que había. Obligaba a configurar la IP en cada máquina y cada vez que cambiaba el DHCP, para el caso más común, que es usar el gateway desde otros dispositivos.
- **Detectar la IP de la LAN en `gateway:init`:** se rompe cuando cambia la IP o hay varias interfaces (Wi-Fi, Ethernet, Docker), y escribe en `.env` un valor que envejece.

## Consecuencias

- La pulsera, la TV, la consola y la app llegan al gateway con `http://<IP>:8080` y `mqtt://<IP>:1884`, sin configuración.
- **MQTT sigue sin TLS.** La barrera del broker son las credenciales y la ACL por pulsera (ADR 0014), y la de la web es el login de la API. Cualquiera en la red puede ver el tráfico MQTT, incluidos el usuario y la contraseña de cada pulsera al conectarse. Los comandos van en claro y sin datos personales, y las lecturas van cifradas con AES-256-GCM.
- **Esto supone una red privada propia.** En una red compartida (universidad, hospital sin VLAN dedicadas), hay que restringir con el bind o con el firewall/VLAN del router antes de levantar el gateway. Transportar MQTT con TLS sigue siendo una decisión pendiente.
- El firewall del sistema operativo puede bloquear los puertos aunque Docker los publique: en Windows hay que permitir 8080, 8081 y 1884 en la red privada.
