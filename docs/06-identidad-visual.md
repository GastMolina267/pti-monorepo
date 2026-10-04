# Identidad visual — Vitalia

Guía de marca de **Vitalia — Ecosistema Digital Hospitalario**. Es la referencia común para el Portal Cautivo, el Backoffice médico, el llamador de TV y cualquier landing del proyecto. Los valores salen del portal cautivo y están implementados en este monorepo en [`libs/shared/design-tokens`](../libs/shared/design-tokens) (SCSS `--vt-*` + TS) y [`libs/shared/ui`](../libs/shared/ui) (componente `<vt-logo>`).

## 1. Marca

|                  |                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **Nombre**       | Vitalia (de _vital_ / signos vitales)                                                                      |
| **Descriptor**   | Ecosistema Digital Hospitalario                                                                            |
| **Productos**    | Vitalia · Portal Cautivo — Vitalia · Backoffice — Vitalia · Llamador                                       |
| **Personalidad** | Clínica pero cálida, confiable, moderna, calma (nunca alarmista salvo en alertas reales)                   |
| **Tono de voz**  | Español rioplatense con voseo ("Conectate", "Seguí tu turno"), frases cortas, sin jerga médica innecesaria |

## 2. Logo

**Isotipo**: cuadrado redondeado (radio 12 sobre 48) con degradé de marca a 135°, cruz médica blanca al 25 % de opacidad, línea de pulso blanca (trazo 3.2, extremos redondeados) y un punto de "conexión" verde `#34D399`. Combina salud + pulso + conectividad.

```svg
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0D9488"/><stop offset="1" stop-color="#0284C7"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="42" height="42" rx="12" fill="url(#g)"/>
  <rect x="20" y="10" width="8" height="28" rx="4" fill="#fff" opacity=".25"/>
  <rect x="10" y="20" width="28" height="8" rx="4" fill="#fff" opacity=".25"/>
  <path d="M12 24H18L21 16L27 32L30 24H36" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="36" cy="24" r="2.5" fill="#34D399"/>
</svg>
```

**Logotipo**: "Vital" en color de texto + "ia" con el degradé de marca (`background-clip: text`). Plus Jakarta Sans 800, `letter-spacing: -0.03em`, tamaño ≈ 0.44 × alto del isotipo.

**Subtítulo** (opcional): `ECOSISTEMA DIGITAL HOSPITALARIO` — 9 px, peso 700, mayúsculas, `letter-spacing: 0.08em`, color muted (`#64748B` claro / `#94A3B8` oscuro).

Archivos: `libs/shared/design-tokens/src/assets/` (isotipo SVG, favicon). Componentes: Angular `<vt-logo [size] [subtitle]>` (`@vitalia/ui`) · React `VitaliaLogo` (portal cautivo).

## 3. Color

### Marca

| Rol                 | Token CSS           | Hex       | Uso                                        |
| ------------------- | ------------------- | --------- | ------------------------------------------ |
| Primario            | `--blue` / `--teal` | `#0D9488` | Botones principales, links, eyebrows, foco |
| Primario claro      | `--blue-2`          | `#14B8A6` | Hover, acentos en modo oscuro              |
| Primario profundo   | `--blue-deep`       | `#0F766E` | Final de degradé de botones, pressed       |
| Secundario          | `--sky`             | `#0284C7` | Fin del degradé de marca, info             |
| Secundario profundo | `--sky-deep`        | `#0369A1` |                                            |
| Secundario claro    | —                   | `#38BDF8` | Acentos en modo oscuro                     |

**Degradé de marca**: `linear-gradient(135deg, #0D9488, #0284C7)` — isotipo, "ia" del logo, tarjetas destacadas (ej. turno actual).
**Botón primario**: `linear-gradient(180deg, #0D9488, #0F766E)`.

### Semánticos (también para estados clínicos del Backoffice)

| Estado          | Hex principal         | Degradé / variante                | Uso clínico                                      |
| --------------- | --------------------- | --------------------------------- | ------------------------------------------------ |
| Éxito / Estable | `#10B981`             | `#059669`, punto vivo `#34D399`   | Paciente estable, pulsera conectada, check-in OK |
| Atención        | `#F59E0B`             | `#D97706`                         | Valores limítrofes, demoras                      |
| Crítico         | `#F43F5E`             | `#BE123C` + animación `critPulse` | Caída detectada, hipoxia, taquicardia            |
| Info            | `#0284C7`             | `#0369A1`                         | Avisos neutros, llamados de turno                |
| Extra           | `#6366F1` / `#06B6D4` | `#4338CA` / `#0891B2`             | Íconos de categorías (`.b-indigo`, `.b-cyan`)    |

### Neutros

| Token            | Claro                   | Oscuro                  |
| ---------------- | ----------------------- | ----------------------- |
| `--bg`           | `#F8FAFC`               | `#06111D`               |
| `--bg-2` / paper | `#F1F5F9` / `#FFFFFF`   | `#0B1A2C`               |
| `--ink` (texto)  | `#0F172A`               | `#F1F5FB`               |
| `--muted`        | `#475569`               | `#94A3B8`               |
| `--muted-2`      | `#64748B`               | `#64748B`               |
| `--surface`      | `rgba(255,255,255,.65)` | `rgba(255,255,255,.05)` |
| `--stroke`       | `rgba(13,148,136,.12)`  | `rgba(20,184,166,.16)`  |
| `--stroke-2`     | `rgba(13,148,136,.18)`  | `rgba(20,184,166,.24)`  |
| divider          | `rgba(15,23,42,.08)`    | `rgba(255,255,255,.09)` |

**Fondo de app** (`--app-bg`): tres halos radiales suaves (teal arriba a la derecha, sky a la izquierda, emerald abajo) sobre un degradé vertical `#F8FAFC → #E2E8F0` (oscuro: `#06111D → #0B1A2C`).

## 4. Tipografía

- **Familia única**: Plus Jakarta Sans, auto-hospedada con `@fontsource/plus-jakarta-sans` (sin CDN, funciona offline en el Edge Gateway). Fallback `system-ui, sans-serif`.
- **Pesos**: 500 (texto), 600 (subtítulos), 700 (botones, labels), 800 (títulos, números grandes).

| Estilo                               | Tamaño   | Peso | Tracking                                                     |
| ------------------------------------ | -------- | ---- | ------------------------------------------------------------ |
| H1                                   | 30–36 px | 800  | -0.03em, `line-height: 1.08`, `text-wrap: balance`           |
| H2                                   | 24–28 px | 800  | -0.025em                                                     |
| H5/H6                                | 16–20 px | 700  | normal                                                       |
| Cuerpo                               | 14–16 px | 500  | normal                                                       |
| Eyebrow                              | 11.5 px  | 800  | 0.16em, MAYÚSCULAS, color primario, con línea de 18 px antes |
| Botón                                | 14–16 px | 700  | sin mayúsculas (`textTransform: none`)                       |
| Cifras clave (turno, signos vitales) | 28–36 px | 800  | -0.04em                                                      |

## 5. Forma, superficie y profundidad

- **Radios**: `--r-lg: 26px` (paneles), `--r-md: 18px`, `--r-sm: 13px`; MUI `shape.borderRadius: 16`; botones 14–16 px; cards 20 px; chips/pills `999px`.
- **Glass** (`.glass`): `background: var(--surface)`, borde `1px solid var(--stroke)`, `backdrop-filter: blur(14px) saturate(1.3)`.
- **Sombras**:
  - CTA primario: `0 12px 30px -8px rgba(13,148,136,.6), inset 0 1px 0 rgba(255,255,255,.28)`
  - Chip de marca: `0 8px 24px -12px rgba(13,148,136,.5)`
  - Tarjeta flotante oscura: `0 18px 40px -14px rgba(0,0,0,.7)` sobre `rgba(6,17,29,.85)`
  - Card sutil: `0 1px 2px 0 rgb(0 0 0 / .05)`
- **Chips**: pill con fondo `linear-gradient(135deg, rgba(13,148,136,.16), rgba(13,148,136,.06))`, borde `rgba(13,148,136,.35)`, texto 12.5 px / 700.
- **Tiles de ícono**: cuadrado redondeado con degradé semántico (`.b-teal`, `.b-blue`, `.b-emerald`, `.b-rose`, `.b-orange`, `.b-indigo`, `.b-cyan`) e ícono blanco.

## 6. Iconografía

- Librería: **Lucide**, con `@lucide/angular` en el monorepo y `lucide-react` en el portal (trazo lineal redondeado, 2–2.6 de grosor).
- Íconos frecuentes: `HeartPulse`, `Activity`, `ShieldCheck`, `Calendar`, `Bell`, `Droplet` (SpO₂), `Thermometer`, `Wifi`, `Check`.

## 7. Movimiento

- Revelado al hacer scroll (`.rv`): `opacity` + `translateY(22px)`, 0.6 s `cubic-bezier(.22,1,.36,1)`, escalonado de 45 ms.
- `pulse` (halo teal en elementos vivos), `floaty` (flotación de 11 px en mockups), `tick` (cambio de números), `critPulse` (halo rose para alertas críticas).
- Siempre respetar `prefers-reduced-motion: reduce`.

## 8. Modos claro/oscuro

Ambos son obligatorios en todas las interfaces. El modo se aplica con `data-theme="light|dark"` en `<html>` + clase `light-mode|dark-mode` en `<body>`, y se persiste en `localStorage` con la clave `vitalia_theme`.

## 9. Implementación

> En este monorepo los tokens CSS llevan prefijo `--vt-` (ej. `--vt-primary`, `--vt-ink`, `--vt-r-lg`); en el portal cautivo se llaman sin prefijo (`--blue`, `--ink`, `--r-lg`). Los valores son idénticos.

- **Apps Angular del monorepo**: `@use 'vitalia' as vt; @include vt.all;` en `styles.scss` (ver [`libs/shared/design-tokens/README.md`](../libs/shared/design-tokens/README.md)).

### Otros frontends

- **Tokens CSS**: copiar el bloque `:root` / `:root[data-theme="dark"]` de `src/index.css` — son agnósticos del framework (sirven igual en Angular, React o HTML plano).
- **MUI (React)**: reutilizar el `createTheme` de `src/themes/ThemeManager.tsx`.
- **Angular Material**: definir una paleta custom con primario `#0D9488`, acento `#0284C7` y warn `#F43F5E`, y la tipografía Plus Jakarta Sans.
- **Backoffice / llamador TV**: priorizar el modo oscuro (`#06111D`) para pantallas siempre encendidas; los estados clínicos usan la tabla de semánticos de la sección 3.
