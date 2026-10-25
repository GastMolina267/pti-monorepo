# AGENTS.md — apps/backoffice (Vitalia Backoffice · Angular 22)

Consola web del personal de salud (VLAN 30): **fila de triaje priorizada**, **alertas biométricas** visuales y sonoras, **llamado de turnos** y estado de los wearables. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Estructura

```
src/app/
  app.ts / app.config.ts / app.routes.ts   # raíz: router, HttpClient (fetch)
  core/
    api/        # un servicio por recurso (tickets, wearables, alerts, health) + api-error.ts (mensajes en español)
    auth/       # AuthService (sesión JWT en localStorage, can(roles)), authInterceptor, authGuard/guestGuard
    realtime/   # RealtimeService: socket.io-client a la sala staff, on(event), ready$ (re-sincronizar)
    live/       # stores en vivo (signals): QueueStore, WearablesStore, AlertsStore. Los arranca el Shell
    sound/      # AlarmService (alarma Web Audio de alertas críticas)
    time/       # ClockService (reloj cada 5 s) + ago()/hhmm()/minutesSince()
    layout/     # shell: navegación, conexión en vivo, sonido, usuario, AlertOverlay
  shared/       # LevelPill, Vitals, AlertKindIcon, TicketActions, CallDialog, VitalsChart (curva SVG), ShowMore/incremental
  features/
    login/      # login del personal
    triage/     # fila priorizada en vivo con signos vitales; PatientVitalsDialog (curva 30 min–24 h)
    tickets/    # todos los turnos del día (filtro y búsqueda); CheckInDialog (recepción)
    alerts/     # alertas activas + historial; alert-overlay (aviso rojo + alarma)
    wearables/  # pulseras: alta, asignar, liberar, última lectura
src/testing/    # dobles para specs (FakeSocket); fuera del build de la app
```

Cada feature es una carpeta con componentes standalone y su ruta lazy (`loadComponent`). Skill `vitalia-angular-feature`.

## Reglas

- **Componentes:** standalone, `OnPush`, signals e `input()`/`output()`, control flow `@if`/`@for`. Archivos `nombre.ts` / `nombre.html` / `nombre.scss` (sin `.component`). Selector con prefijo `vt-`.
- **Estado:** signals y `computed` en servicios `providedIn: 'root'`. Sin NgRx hasta que haga falta (registrar un ADR antes de sumarlo).
- **Tiempo real:** los eventos llegan por `RealtimeService.on(...)`; los stores de `core/live` los aplican. `queue:updated` es un aviso: se vuelve a pedir `GET /api/tickets` (con debounce). Al reconectar (`ready$`), todo store vuelve a pedir su estado. Las acciones aplican la respuesta de la API sin esperar al WebSocket.
- **Permisos en la UI:** `AuthService.can(ROLES_CAN_*)` para mostrar u ocultar acciones. La API los vuelve a validar siempre.
- **Sonido:** solo con `AlarmService`. Los navegadores lo bloquean hasta una interacción: `unlock()` en un click.
- **HTTP:** URLs relativas `/api/...` (en dev el proxy `proxy.conf.json` las manda a :3000). Los tipos salen de `@vitalia/contracts`.
- **UI:** primero Angular Material (tema M3 Vitalia) y las utilidades `.vt-*`. Íconos con `@lucide/angular` (`<svg lucideX>`). Nada de CDNs.
- **Triaje:** colores con `.vt-level--stable|attention|critical` o `TRIAGE_COLORS`, y la clasificación siempre con `assessVitals()` de contracts.
- **Alertas críticas:** contraste alto, animación `vt-crit-pulse`, sonido y respeto de `prefers-reduced-motion`.
- **Accesibilidad:** `aria-label` en botones de ícono y foco visible. Responsivo de móvil a escritorio (RNF-O4).
- **Tests:** vitest + TestBed (`pnpm nx test backoffice`). Socket con `FakeSocket` por `SOCKET_FACTORY`; HTTP con `provideHttpClientTesting`. La lógica pura (ordenar, filtrar, aplicar lecturas) va en funciones exportadas y se prueba sin TestBed.
- **Listas largas:** toda lista que pueda tener cientos de filas (fila de triaje, Turnos) se dibuja con `incremental()` + `<vt-show-more>` (tandas de 50) y los contadores muestran los totales. Con 10.000 turnos, dibujar todo tardaba 7–12 s (`pnpm perf:stress --ui=…`, `docs/10-validacion.md`).
- **Gráficos:** SVG propio (`shared/vitals-chart`), sin librerías de charts: paneles chicos por signo, bandas normales de `CLINICAL_THRESHOLDS`, cortes en los huecos, tooltip sincronizado y vista de tabla.
- **E2E (4d):** `pnpm gateway:e2e` prueba la UI compilada contra Docker (asignar, reconocer, llamar y reconectar sin recarga). `AlertsStore` reconcilia por IDs y versión de consulta; no recuperar alertas conocidas ausentes del snapshot ni reconocidas desde una respuesta vieja. Ver ADR 0016 y `docs/09-despliegue-gateway.md`.

## Comandos

```bash
pnpm nx serve backoffice   # http://localhost:4200 (proxy /api y /socket.io → :3000)
pnpm nx test backoffice
pnpm nx build backoffice
```
