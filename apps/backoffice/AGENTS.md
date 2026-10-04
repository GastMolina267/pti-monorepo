# AGENTS.md — apps/backoffice (Vitalia Backoffice · Angular 22)

Consola web del personal de salud (VLAN 30): **fila de triaje priorizada**, **alertas biométricas** visuales y sonoras, **llamado de turnos** y estado de los wearables. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Estructura

```
src/app/
  app.ts / app.config.ts / app.routes.ts   # raíz: router, HttpClient (fetch)
  core/
    api/        # servicios de acceso a la API (httpResource / HttpClient). Un archivo por recurso: health.api.ts
    layout/     # shell (topbar con logo + tema, footer)
    # Fase 3: auth/ (guard + interceptor JWT), realtime/ (cliente Socket.IO)
  features/
    home/       # dashboard de bienvenida + vista previa de la fila ✅
    # Fase 3: triage/ (fila priorizada), alerts/, tickets/ (llamador), wearables/, login/
```

Cada feature es una carpeta con componentes standalone y su ruta lazy (`loadComponent`). Skill `vitalia-angular-feature`.

## Reglas

- **Componentes:** standalone, `OnPush`, signals e `input()`/`output()`, control flow `@if`/`@for`. Archivos `nombre.ts` / `nombre.html` / `nombre.scss` (sin `.component`). Selector con prefijo `vt-`.
- **Estado:** signals y `computed` en servicios `providedIn: 'root'`. Sin NgRx hasta que haga falta (registrar un ADR antes de sumarlo).
- **HTTP:** URLs relativas `/api/...` (en dev el proxy `proxy.conf.json` las manda a :3000). Los tipos salen de `@vitalia/contracts`.
- **UI:** primero Angular Material (tema M3 Vitalia) y las utilidades `.vt-*`. Íconos con `@lucide/angular` (`<svg lucideX>`). Nada de CDNs.
- **Triaje:** colores con `.vt-level--stable|attention|critical` o `TRIAGE_COLORS`, y la clasificación siempre con `assessVitals()` de contracts.
- **Alertas críticas:** contraste alto, animación `vt-crit-pulse`, sonido y respeto de `prefers-reduced-motion`.
- **Accesibilidad:** `aria-label` en botones de ícono y foco visible. Responsivo de móvil a escritorio (RNF-O4).
- **Tests:** vitest + TestBed (`pnpm nx test backoffice`).

## Comandos

```bash
pnpm nx serve backoffice   # http://localhost:4200 (proxy /api y /socket.io → :3000)
pnpm nx test backoffice
pnpm nx build backoffice
```
