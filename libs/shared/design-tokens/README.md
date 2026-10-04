# @vitalia/design-tokens

Identidad visual **Vitalia** lista para usar en cualquier frontend del monorepo.

| Archivo                     | Contenido                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `src/styles/_vitalia.scss`  | Entrada SCSS: `@use 'vitalia' as vt; @include vt.all;`                                    |
| `src/styles/_tokens.scss`   | CSS custom properties `--vt-*` (claro / oscuro)                                           |
| `src/styles/_material.scss` | Tema Angular Material M3 con los hex de la marca                                          |
| `src/styles/_base.scss`     | Base + utilidades (`.vt-glass`, `.vt-eyebrow`, `.vt-chip`, `.vt-tile--*`, `.vt-level--*`) |
| `src/lib/brand.ts`          | Constantes TS (`COLORS`, `TRIAGE_COLORS`, `THEME_STORAGE_KEY`…)                           |
| `src/assets/`               | Isotipo SVG y favicon                                                                     |

Las apps Angular agregan `libs/shared/design-tokens/src/styles` a `stylePreprocessorOptions.includePaths` y copian `src/assets` a su carpeta pública.

Guía completa: [`docs/06-identidad-visual.md`](../../../docs/06-identidad-visual.md).
