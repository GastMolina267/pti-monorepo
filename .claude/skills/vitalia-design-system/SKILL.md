---
name: vitalia-design-system
description: Aplicar la identidad visual Vitalia (logo, paleta teal/sky, colores de estados clínicos, tipografía Plus Jakarta Sans, radios, glass, sombras, animaciones, modo claro/oscuro) en el Backoffice, la TV, una landing o el portal cautivo. Usala al crear o modificar cualquier UI, al elegir colores o estilos, o al agregar componentes visuales.
---

# Sistema de diseño Vitalia

Guía completa: `docs/06-identidad-visual.md`. Implementación: `libs/shared/design-tokens` (SCSS + TS) y `libs/shared/ui` (componentes Angular).

## Esencia

Clínica pero cálida, calma y confiable. Base teal **#0D9488** → sky **#0284C7** (degradé de marca a 135°), superficies glass suaves y halos radiales de fondo. Los rojos y ámbar quedan **reservados para estados clínicos**.

## Cómo aplicarla en Angular

1. Estilos globales (ya configurado en las apps):
   ```scss
   // apps/<app>/src/styles.scss  (includePaths → libs/shared/design-tokens/src/styles)
   @use 'vitalia' as vt;
   @include vt.all;   // tokens --vt-* + tema Material M3 + base/utilidades
   ```
2. En componentes usá **solo tokens**:
   ```scss
   .card { background: var(--vt-paper); border: 1px solid var(--vt-divider); border-radius: var(--vt-r-card); }
   .title { color: var(--vt-ink); font-weight: 800; letter-spacing: -0.02em; }
   .hint { color: var(--vt-muted); }
   ```
3. Utilidades disponibles: `.vt-glass`, `.vt-eyebrow`, `.vt-chip`, `.vt-text-gradient`, `.vt-tile .vt-tile--{teal|blue|emerald|amber|rose|indigo}`, `.vt-level--{stable|attention|critical}` (define `--vt-level`), `.vt-reveal`.
4. Componentes: `<vt-logo [size]="38" />`, `<vt-theme-toggle />` (`@vitalia/ui`). Angular Material para controles (botones, inputs, tablas, diálogos).
5. En TS (gráficos, canvas): `COLORS`, `TRIAGE_COLORS`, `NEUTRALS` de `@vitalia/design-tokens`.

## Tokens clave

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--vt-primary` | #0D9488 | #0D9488 | Acción principal, links, foco |
| `--vt-secondary` | #0284C7 | | Info, fin del degradé |
| `--vt-success` | #10B981 | | Estable, conectado |
| `--vt-warning` | #F59E0B | | Atención |
| `--vt-danger` | #F43F5E | | Crítico (+ `vt-crit-pulse`) |
| `--vt-bg` / `--vt-paper` | #F8FAFC / #FFF | #06111D / #0B1A2C | Fondos |
| `--vt-ink` / `--vt-muted` | #0F172A / #475569 | #F1F5FB / #94A3B8 | Texto |
| `--vt-stroke` | teal 12 % | teal 16 % | Bordes |
| `--vt-r-lg/md/sm/card/button` | 26/18/13/20/14 px | | Radios |

## Tipografía

Plus Jakarta Sans (auto-hospedada). H1 30–36 px/800/-0.03em · H2 800/-0.025em · cuerpo 14–16 px/500 · eyebrow 11.5 px/800/0.16em en mayúsculas · botones 700 sin mayúsculas · cifras clave 800/-0.04em.

## Reglas

- **No hay hex fuera de `libs/shared/design-tokens`.** Si falta un color, agregá un token (en claro y en oscuro) y su espejo en `brand.ts`.
- Todo se verifica en **claro y oscuro**. La TV es siempre oscura.
- Estados clínicos: verde = estable, ámbar = atención, rojo = crítico. **Nunca uses solo el color**: sumá texto o ícono (accesibilidad).
- Movimiento sutil (`--vt-ease`, 0.6 s), siempre con `prefers-reduced-motion`.
- Sin CDNs: fuentes con `@fontsource`, íconos `@lucide/angular`.
- Voz: español rioplatense con voseo, frases cortas y calmas. Alarmista solo ante alertas reales.
- El portal cautivo (React + MUI, repo aparte) usa la misma identidad: si cambiás la marca acá, replicalo allá.
