# @vitalia/ui

Componentes Angular compartidos con la identidad Vitalia (standalone, signals, OnPush, zoneless).

| Export                                               | Uso                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `Logo` (`<vt-logo [size]="40" [subtitle]="null" />`) | Isotipo + logotipo Vitalia                                              |
| `ThemeService`                                       | Modo claro/oscuro (`mode()`, `toggle()`), persistido en `vitalia_theme` |
| `ThemeToggle` (`<vt-theme-toggle />`)                | Botón de cambio de modo                                                 |

Requiere que la app incluya los estilos de `@vitalia/design-tokens` (`@include vt.all`).
