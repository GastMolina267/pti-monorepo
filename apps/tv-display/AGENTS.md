# AGENTS.md — apps/tv-display (Vitalia Llamador · Angular 22)

Pantalla **pasiva** del hall de la sala de espera (VLAN 40, modo kiosco). Muestra el turno llamado y los últimos llamados. Recibe `ticket:called` por Socket.IO con un objetivo de menos de 100 ms. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Reglas

- **Siempre modo oscuro** (`data-theme="dark"` fijo en `index.html`) para pantallas encendidas todo el día.
- Tipografía grande en unidades `vh`/`clamp()`, legible a 5 m. Sin interacción de mouse ni teclado.
- Tiene que tolerar cortes: reconexión automática del socket y último estado conocido visible.
- Aviso al llamar: campanita Web Audio + voz `speechSynthesis` (`AnnouncerService`, sin servicios externos). En kiosco: Chrome con `--kiosk --autoplay-policy=no-user-gesture-required`; si no, la pantalla pide un toque para habilitar el sonido.
- Estructura: `core/realtime/` (socket a la sala `tv`, `ready$`), `core/sound/` (anunciador), `features/display/` (pantalla y `call-board.ts`, lógica pura del tablero).
- Al arrancar y en cada reconexión pide `GET /api/tickets/recent-calls`; el tablero se guarda en `localStorage` para mostrar el último estado si se recarga sin conexión.
- **Una TV por sala de espera (5a):** `?servicio=GUARDIA` (sin distinguir mayúsculas) filtra `recent-calls?serviceCode=` y los `ticket:called` por `serviceCode`, muestra el servicio bajo el logo y guarda el tablero con una clave por servicio. Sin el parámetro, muestra todos.
- **Nunca** muestra datos clínicos ni nombres: solo código de turno, consultorio y profesional.
- **E2E (4d):** `pnpm gateway:e2e` verifica el llamado real por Nginx y la recuperación de uno emitido mientras el navegador estuvo desconectado, sin recargar la página. Usa un contexto Chromium aislado y datos simulados.

## Comandos

```bash
pnpm nx serve tv-display   # http://localhost:4300
```
