# 0024. Exposición pública del gateway con Cloudflare Tunnel

- Estado: Aceptado
- Fecha: 2026-10-27
- Autores: Gastón Molina

## Contexto

El gateway está pensado para la red del hospital y para funcionar sin internet (ADR 0013, ADR 0022). Para las demos, la defensa y las pruebas de la app del paciente en un celular con datos móviles, hace falta mostrar los servicios desde afuera: Backoffice, TV, la API (con Swagger) y la landing. Hay que lograrlo sin abrir puertos en el router de una red propia o ajena, sin IP pública y sin cambiar las apps.

## Decisión

- **`cloudflared` como servicio del mismo compose** (`docker-compose.gateway.yml`), en perfiles opcionales. `gateway:up` no lo levanta: la exposición siempre es un paso explícito, con `pnpm gateway:tunnel`.
  - Perfil `tunnel`: tres túneles rápidos (`trycloudflare.com`), uno por origen (`web:8080`, `web:8081` y `landing:8082`). No requieren cuenta y la URL es aleatoria.
  - Perfil `tunnel-named`: un túnel con nombre (`CLOUDFLARE_TUNNEL_TOKEN`), con los hostnames fijos configurados en Cloudflare.
- **Un túnel por origen**, porque Backoffice y TV llaman a `/api` y `/socket.io` en su mismo origen (ADR 0022). Así no hacen falta CORS, rutas con prefijo ni builds distintos.
- **La landing entra al compose** como imagen Nginx propia (target `landing` del Dockerfile, puerto 8082). Mientras no esté publicada, se expone desde el gateway. Sigue siendo un sitio estático que no habla con la API (ADR 0020).
- **MQTT y PostgreSQL nunca se exponen.** Las pulseras siguen en la LAN.
- **`TRUST_PROXY` y Swagger son configurables** (`GATEWAY_TRUST_PROXY` y `GATEWAY_SWAGGER`). Detrás del túnel hay dos saltos de proxy, y `gateway:tunnel` usa 2 para que los límites por IP de login, check-in y vinculación sean por cliente.
- `gateway:tunnel` espera a que cada túnel publique su URL, la verifica (`/api/health` o `/gateway-health`) y la guarda en `.gateway/tunnel-urls.txt`.

## Alternativas consideradas

- **Abrir puertos en el router** (port forwarding): exige IP pública y acceso al router, y no da HTTPS. En la red de la universidad, además, no es posible.
- **ngrok o Tailscale Funnel:** sirven igual, y quedan documentados en el README. ngrok gratis interpone una página de aviso y Tailscale requiere instalar un agente. Cloudflare Tunnel corre en Docker, sin cuenta para los túneles rápidos y con dominio propio cuando haga falta.
- **Instalar `cloudflared` en Windows:** suma otro paso de instalación y deja procesos sueltos. En el compose comparte la red de los contenedores y se baja con `gateway:tunnel-down` o `gateway:down`.
- **Un solo hostname con rutas por prefijo** (`/tv`, `/landing`): habría que cambiar el `base href` y las rutas de las apps.

## Consecuencias

- La exposición depende de internet y de Cloudflare. El funcionamiento offline del gateway no cambia: sin túnel todo sigue en la LAN.
- Expuesto, el login de la API queda en internet. Solo se usan datos simulados y el `SEED_PASSWORD` aleatorio del gateway, y los túneles se bajan al terminar. Para un uso más largo: túnel con nombre y Cloudflare Access.
- Las URLs de los túneles rápidos cambian cada vez que se recrea su contenedor. Para una URL fija en el APK o en una presentación, hace falta el túnel con nombre.
- `gateway:up` recrea la API con `TRUST_PROXY=1`. Si los túneles quedan arriba, hay que volver a correr `gateway:tunnel` o fijar `GATEWAY_TRUST_PROXY=2`.
