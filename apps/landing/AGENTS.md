# AGENTS.md — apps/landing (Vitalia Landing · Angular 22)

Sitio público de Vitalia con **dos audiencias** y un selector en la navegación ([ADR 0020](../../docs/adr/0020-landing-b2c-b2b.md)). No consume la API ni corre en el gateway: se publica como sitio estático. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md).

| Ruta             | Audiencia                                          | Pieza central                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`              | **Personas (B2C):** pacientes, familias, comunidad | Recorrido con scroll (`features/personas/journey*`): la cámara vuela por 5 escenas SVG. Además: pulsera en vivo (`live-vitals`), llamador (`call-ticker`) y una mañana en la guardia (`waiting-timeline`) |
| `/instituciones` | **Instituciones (B2B):** hospitales e inversores   | Calculadora de ingresos (`revenue-*`) y campo de 6.729 establecimientos (`market-field.ts`). Además: gráficos por cifra (`fact-viz`) y arquitectura con corte de internet simulado (`architecture`)       |
| `/privacidad`    | Todas                                              | Qué guarda el sitio y qué el producto                                                                                                                                                                     |

## Reglas

- **Copy en `*.content.ts`**, separado de las plantillas, en español rioplatense. Sin cifras inventadas: cada dato de mercado lleva su `Source` (`core/site.ts`) y los supuestos de la calculadora se presentan como estimación editable.
- **Animaciones solo con anime.js a través de `core/motion.ts`** (`Motion.scoped`): respeta `prefers-reduced-motion`, no corre en jsdom y revierte el scope al destruir. Un único momento orquestado por página al cargar. El resto del movimiento responde al scroll o a una acción.
- **Lógica pura y testeable** fuera de los componentes: `journey-camera.ts` (cámara y señal), `revenue-model.ts` (ingresos y formato es-AR), `buildMailto` y `shuffledIndices`.
- **Escala propia `--lp-*`** (espaciado y tipografía en pasos fijos) sobre los tokens `--vt-*`. Sin hex sueltos, como en el resto del monorepo.
- **Contraste AA** (patrones en [06-identidad-visual §10](../../docs/06-identidad-visual.md#10-landing)): texto chico en `--vt-muted` (no `--vt-muted-2`), enlaces en `--vt-primary-deep` (claro) y `--vt-primary-light` (oscuro), botón primario `--vt-primary-deep` con texto blanco. En estilos de componente, el modo oscuro va con `:host-context([data-theme='dark'])`.
- **Widgets "en vivo"** con `shared/live-feed.ts` (`liveTicker`): solo avanzan en pantalla y con la pestaña visible, tienen botón de pausa y arrancan pausados con movimiento reducido. Todo dato que muestran es simulado y lo dicen.
- **Fondo de luz** (`shared/ambient-light.ts`, en el shell): grilla de puntos tipo monitor, luz que sigue al cursor (o deriva sola en táctiles), un latido de luz cada 3 s y auroras de marca. Es un canvas fijo detrás del contenido (`main` y el pie van en `z-index: 1`), sin `filter: blur` (caro sin GPU), que no dibuja con la pestaña oculta y queda estático con movimiento reducido. Las tarjetas principales llevan `vtSpotlight` (`shared/spotlight.ts`): brillo y borde que siguen al mouse.
- **Recorrido:** la cámara es cuadrada y el escenario es el cuadrado más grande que entra en el alto visible (`container-type: size`), así no se recorta en ninguna proporción. El timeline sigue a la lista de pasos (`flightWindow`): cada escena queda quieta mientras su texto cruza el centro.
- Responsivo desde 360 px y sin scroll horizontal (verificado en 360, 390, 768, 1024, 1280, 1366, 1440, 1920 y 2560 px). En móvil, el recorrido muestra el texto del paso activo pegado al escenario (`.caption`).
- **App del paciente:** el copy dice que hoy no hace falta descargar nada (portal cautivo) y que la app está en desarrollo (`PROMISES` con `tag`, `ROADMAP` con `state: 'now'`). Cuando se publique, actualizalo.
- Antes de publicar: reemplazar `SITE.contactEmail` y revisar la fecha de las fuentes.

## Comandos

```bash
pnpm nx serve landing      # http://localhost:4400
pnpm nx test landing
pnpm nx build landing      # dist/apps/landing/browser (estático)
```
