# AGENTS.md — apps/tv-display (Vitalia Llamador · Angular 22)

Pantalla **pasiva** del hall de la sala de espera (VLAN 40, modo kiosco). Muestra el turno llamado y los últimos llamados. Recibe `ticket:called` por Socket.IO con un objetivo de menos de 100 ms. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

## Reglas

- **Siempre modo oscuro** (`data-theme="dark"` fijo en `index.html`) para pantallas encendidas todo el día.
- Tipografía grande en unidades `vh`/`clamp()`, legible a 5 m. Sin interacción de mouse ni teclado.
- Tiene que tolerar cortes: reconexión automática del socket y último estado conocido visible.
- Opcional: aviso sonoro o voz al llamar (Web Audio / `speechSynthesis`, sin servicios externos).
- Estructura: `features/display/` (pantalla principal). En Fase 3, `core/realtime/` con el cliente Socket.IO (skill `vitalia-realtime`).

## Comandos

```bash
pnpm nx serve tv-display   # http://localhost:4300
```
