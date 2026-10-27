<p align="center">
  <img src="libs/shared/design-tokens/src/assets/vitalia-isotipo.svg" width="72" alt="Vitalia" />
</p>

<h1 align="center">Vitalia</h1>
<p align="center"><b>Ecosistema Digital Hospitalario</b> · Conectividad gestionada · Turnos omnicanal · Monitoreo biométrico IoMT</p>
<p align="center">Proyecto Tecnológico Integrador — Ingeniería Informática, Universidad Blas Pascal (2026)</p>

---

Monorepo **Nx** con el backend del **Edge Gateway** y las interfaces del personal de salud. Todo corre localmente en el hospital (Fog Computing) y sigue operando **sin internet**.

| Proyecto                                                   | Descripción                                                                                            | Stack                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| [`apps/api`](apps/api)                                     | Backend único: turnos, check-in, auth; luego telemetría MQTT, alertas y tiempo real                    | NestJS 11 + TypeORM           |
| [`apps/backoffice`](apps/backoffice)                       | Consola de triaje y monitoreo para el personal                                                         | Angular 22 + Material         |
| [`apps/tv-display`](apps/tv-display)                       | Llamador de turnos para la sala de espera                                                              | Angular 22                    |
| [`apps/landing`](apps/landing)                             | Sitio público: B2C (`/`) y B2B para hospitales e inversores (`/instituciones`)                         | Angular 22 + anime.js         |
| [`apps/patient-app`](apps/patient-app)                     | App Android del paciente: turnero, signos vitales, agenda y ficha de salud                             | Flutter 3.44                  |
| [`apps/wearable-firmware-poc`](apps/wearable-firmware-poc) | Firmware de la pulsera IoMT: sensores, detección de caídas y telemetría cifrada (AES-256-GCM) por MQTT | C++17 · PlatformIO (ESP32-C3) |
| [`libs/shared/contracts`](libs/shared/contracts)           | Contratos compartidos (REST, WS, MQTT, reglas clínicas)                                                | TypeScript                    |
| [`libs/shared/design-tokens`](libs/shared/design-tokens)   | Identidad visual Vitalia                                                                               | SCSS + TS                     |
| [`libs/shared/ui`](libs/shared/ui)                         | Componentes Angular de marca                                                                           | Angular                       |

Repo relacionado: portal cautivo (`pti-captive-portal`, React).

## Servicios

Hay dos formas de levantar todo. **Desarrollo** corre cada app con Nx y recarga en caliente. **Gateway** corre las imágenes de producción en Docker, que es lo que se instala en el hospital y lo que se expone a internet.

| Servicio                   | Desarrollo (`pnpm dev:*`)            | Gateway (Docker)                            | Público (túnel)                       |
| -------------------------- | ------------------------------------ | ------------------------------------------- | ------------------------------------- |
| API REST + Socket.IO       | <http://localhost:3000/api>          | detrás de Nginx: `:8080/api`                | `https://<backoffice>/api`            |
| Swagger                    | <http://localhost:3000/api/docs>     | `:8080/api/docs` con `GATEWAY_SWAGGER=true` | `https://<backoffice>/api/docs`       |
| Backoffice (consola)       | <http://localhost:4200>              | <http://localhost:8080>                     | `https://<backoffice>`                |
| TV (llamador)              | <http://localhost:4300>              | <http://localhost:8081>                     | `https://<tv>`                        |
| Landing                    | <http://localhost:4400>              | <http://localhost:8082> (perfil `landing`)  | `https://<landing>`                   |
| PostgreSQL 16              | `localhost:5432` (`pnpm infra:up`)   | sin puerto publicado                        | no se expone                          |
| Mosquitto (MQTT)           | `localhost:1883`, anónimo            | `:1884`, usuario y ACL por pulsera          | no se expone                          |
| Pulseras simuladas         | `pnpm sim:wearables`                 | `pnpm sim:wearables --gateway`              | corren en la misma máquina            |
| Réplica a la nube (sink)   | `pnpm cloud:sink` (:4900)            | `CLOUD_SYNC_URL` en `.gateway/.env`         | —                                     |
| App del paciente (Android) | `pnpm app:emulator` + `pnpm app:run` | APK de la CI o `pnpm app:apk`               | URL `https://<backoffice>` en Ajustes |

### Desarrollo

```bash
pnpm install
cp .env.example .env
pnpm infra:up       # PostgreSQL 16 + Mosquitto 2 (Docker)
pnpm db:migrate     # tablas (TypeORM)
pnpm db:seed        # datos simulados · usuarios *@vitalia.local / Vitalia2026!
pnpm dev            # API :3000 · Backoffice :4200 · TV :4300
pnpm dev:landing    # landing :4400 (aparte: no depende de la API)
pnpm sim:wearables  # pulseras simuladas con telemetría cifrada (otra terminal)
```

Cada uno por separado: `pnpm dev:api`, `dev:backoffice`, `dev:tv`, `dev:landing`. Backoffice y TV llaman a `/api` y `/socket.io` en su mismo origen, y el dev-server los reenvía a `:3000`. La app del paciente se prueba en el emulador contra la API de desarrollo ([docs/11-app-paciente.md](docs/11-app-paciente.md)). Setup completo en Windows: [docs/guia-desarrollo.md](docs/guia-desarrollo.md).

El modo desarrollo es para la máquina propia: no lo expongas a internet. Usa la contraseña conocida del seed, Swagger abierto y dev-servers sin optimizar.

### Gateway en Docker

Requiere Docker Desktop con el motor Linux. Las contraseñas (base, JWT, AES, seed y MQTT) se generan al azar en `.gateway/.env`, que no se versiona.

```bash
pnpm install --frozen-lockfile
pnpm gateway:up       # API, PostgreSQL, Mosquitto y Nginx con Backoffice (:8080) y TV (:8081)
pnpm gateway:seed     # datos simulados; la contraseña de los usuarios es SEED_PASSWORD de .gateway/.env
pnpm gateway:smoke    # HTML, rutas, health, últimos llamados y Socket.IO a través de Nginx
pnpm sim:wearables --gateway          # telemetría cifrada con las identidades del broker
pnpm gateway:down     # para todo y conserva los datos
```

Desde otro dispositivo de la red: `http://<IP de la PC>:8080`, `:8081` y `mqtt://<IP>:1884` ([ADR 0022](docs/adr/0022-gateway-expuesto-por-defecto.md)). En Windows hay que permitir esos puertos en el firewall para la red privada. Para sumar la landing sin túnel: `node tools/scripts/gateway-compose.mjs --profile landing up -d --build landing`.

Configuración, MQTT, E2E, respaldos y demo: [docs/09-despliegue-gateway.md](docs/09-despliegue-gateway.md).

### Exponer a internet con Cloudflare Tunnel

`cloudflared` corre como contenedor dentro del mismo compose y abre una conexión **saliente** a Cloudflare. No hace falta abrir puertos en el router, tener IP pública ni instalar nada además de Docker. Cloudflare entrega HTTPS, y Socket.IO funciona por WebSocket.

**Túneles rápidos (sin cuenta):**

```bash
pnpm gateway:up            # si el gateway no está levantado
pnpm gateway:tunnel        # landing + 3 túneles; imprime y verifica las URLs públicas
pnpm gateway:tunnel-urls   # vuelve a mostrar las URLs (también en .gateway/tunnel-urls.txt)
pnpm gateway:tunnel-down   # baja la landing y los túneles; el gateway sigue en la LAN
```

Cada servicio recibe su propia URL `https://<palabras>.trycloudflare.com`: Backoffice (con la API, `/api/health` y `/api/docs`), TV y landing. Las URLs **cambian** cada vez que se recrean los contenedores de túnel, no tienen garantía de disponibilidad y son para demos y pruebas.

**Túnel con nombre (URLs fijas y dominio propio):** hace falta una cuenta de Cloudflare con un dominio.

1. En Cloudflare Zero Trust, _Networks → Tunnels → Create a tunnel_ (tipo Cloudflared). Copiá el token.
2. En la pestaña _Public Hostname_ del túnel, agregá tres rutas. El servicio es el nombre del contenedor dentro de la red del compose:
   - `consola.tu-dominio.com` → `HTTP` `web:8080`
   - `tv.tu-dominio.com` → `HTTP` `web:8081`
   - `www.tu-dominio.com` → `HTTP` `landing:8082`
3. Agregá a `.gateway/.env`: `CLOUDFLARE_TUNNEL_TOKEN=<token>`.
4. `pnpm gateway:tunnel` detecta el token y levanta el contenedor `tunnel` en lugar de los rápidos.

Opcionales en `.gateway/.env`:

- `GATEWAY_SWAGGER=true` publica Swagger en `/api/docs`.
- `GATEWAY_TRUST_PROXY=2` deja fijo el número de saltos de proxy. Detrás del túnel hay dos (cloudflared → Nginx) y la API los necesita para contar los límites de login, check-in y vinculación por cliente. `gateway:tunnel` lo pone en 2 solo mientras corre, y `gateway:up` lo vuelve a 1.
- `GATEWAY_EXTRA_CORS_ORIGINS=https://…` es solo para un cliente servido desde otro origen, como el portal cautivo en su propio dominio. Backoffice y TV no lo necesitan.

**Clientes por el túnel:**

- **App del paciente:** en _Ajustes → Servidor del hospital_ poné la URL del Backoffice (`https://…`). Para compilar el APK ya apuntado al túnel, usá `pnpm nx run patient-app:build-apk --api=https://…`, o cargá la variable `VITALIA_GATEWAY_URL` del repo para el APK de la CI.
- **Pulseras y simuladores:** MQTT **no** se expone. Se conectan al gateway por la LAN (`:1884`).
- **Portal cautivo:** apuntá su API a `https://<backoffice>/api` y sumá su origen a `GATEWAY_EXTRA_CORS_ORIGINS`.

**Seguridad:** al exponer el gateway, el login de la API queda abierto a internet. Usá solo datos simulados (Ley 25.326) y el `SEED_PASSWORD` aleatorio, nunca la contraseña del seed de desarrollo. Bajá los túneles al terminar la demo. Para limitar quién entra, con el túnel con nombre podés sumar _Cloudflare Access_ (login por correo) a cada hostname.

**Alternativas:**

- **ngrok:** `ngrok http 8080`, un comando por servicio. El plan gratis muestra una página de aviso antes de entrar.
- **Tailscale Funnel:** `tailscale funnel 8080`. Requiere instalar Tailscale en la PC.
- **localtunnel:** `npx localtunnel --port 8080`. Es menos estable.

Todas apuntan a los mismos puertos del gateway (8080, 8081 y 8082) y necesitan `GATEWAY_TRUST_PROXY=2`.

Decisión y límites: [ADR 0024](docs/adr/0024-exposicion-publica-con-cloudflare-tunnel.md).

### Otros scripts

El firmware recibe `SHOW_TICKET` y muestra el llamado en el OLED. Para verificar sus tests y su compilación sin placa: `pnpm nx run wearable-firmware-poc:pio-check-docker`. Recorrido integrado sobre el gateway sembrado: `pnpm gateway:e2e-install` y `pnpm gateway:e2e`.

| Script                                                                | Acción                                   |
| --------------------------------------------------------------------- | ---------------------------------------- |
| `pnpm dev` / `dev:api` / `dev:backoffice` / `dev:tv` / `dev:landing`  | Servidores de desarrollo                 |
| `pnpm gateway:up` / `gateway:down` / `gateway:seed` / `gateway:smoke` | Gateway en Docker                        |
| `pnpm gateway:tunnel` / `gateway:tunnel-urls` / `gateway:tunnel-down` | Exposición pública con Cloudflare Tunnel |
| `pnpm app:emulator` / `app:run` / `app:test` / `app:apk`              | App Flutter del paciente                 |
| `pnpm fw:build` / `fw:upload` / `fw:monitor`                          | Firmware del wearable (PlatformIO)       |
| `pnpm affected`                                                       | Lint + test + build de lo afectado       |
| `pnpm check`                                                          | Todo el workspace + format check         |
| `pnpm infra:up` / `infra:down` / `infra:logs`                         | Infraestructura Docker de desarrollo     |
| `pnpm graph`                                                          | Grafo de dependencias de Nx              |
| `pnpm ai:sync`                                                        | Sincroniza las skills de IA              |

## Documentación

Todo está en [`docs/`](docs/README.md): visión, arquitectura, dominio, contratos, convenciones, identidad visual, **[roadmap por fases](docs/07-roadmap.md)** y ADRs.

## Desarrollo con IA

El repo está preparado para Claude Code, Codex, Cursor, Gemini/Antigravity y Copilot: [`AGENTS.md`](AGENTS.md) es la fuente única de contexto y hay **skills** del proyecto en `.agents/skills/` además del Nx MCP. Ver [guía](docs/guia-desarrollo.md#trabajar-con-ia).

## Equipo

Facundo Gomez Geneiro · Gastón Molina · Tomás Molina — Tutor: Oscar Luis Gencarelli
