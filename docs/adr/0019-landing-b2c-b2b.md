# 0019. Landing con dos audiencias (B2C y B2B) en Angular y anime.js

- Estado: Aceptado
- Fecha: 2026-10-25
- Autores: Tomás Molina

## Contexto

La Fase 6 pide una landing de Vitalia con la misma identidad que el resto del producto. Tiene que hablarle a dos públicos distintos:

- **Personas (B2C):** pacientes, familias y comunidad que quieren entender qué es Vitalia y cómo cambia la espera en un hospital.
- **Instituciones (B2B):** hospitales, financiadores e inversores. Necesitan ver el mercado, cómo se generan los ingresos y por qué el modelo se sostiene.

Además se pidió usar [anime.js](https://animejs.com), las skills [ai-design-skills](https://github.com/elayadesign/ai-design-skills) y [scroll-world](https://github.com/oso95/scroll-world), y revisar el resultado con una crítica de diseño. El router, el portal cautivo y la pulsera quedan fuera de este repo, pero la landing los muestra como parte de la arquitectura.

## Decisión

- **Una app nueva `apps/landing`** (Angular 22, zoneless, generada con Nx), con los tags `scope:landing` y `type:app`. Solo depende de `@vitalia/ui` y `@vitalia/design-tokens`: no consume la API, porque es un sitio público fuera del gateway.
- **Dos rutas con un mismo shell:** `/` (Personas) e `/instituciones`. Un selector en la navegación cambia de una a la otra. La URL define la audiencia, así cada página se puede compartir y tiene su propio título.
- **Manda la identidad Vitalia:** Plus Jakarta Sans, tokens `--vt-*`, íconos Lucide y glass. De ai-design-skills se toman la estructura (un CTA principal, el FAQ, la frase grande que se enciende palabra por palabra), la escala de espaciado y tipografía y las curvas con masa. Sus reglas de fuente, íconos y fondos chocan con la marca y no se aplican.
- **scroll-world sin video:** la skill necesita APIs pagas de generación de video (Monid/Higgsfield). Su idea, que la cámara vuele de escena en escena siguiendo el scroll, se hace con un SVG y un timeline de anime.js sincronizado con `onScroll`. La cámara es el `viewBox`, y la línea de pulso del isotipo conecta celular, pulsera, gateway, consola y TV.
- **El recorrido se adapta a cualquier pantalla:** la cámara es cuadrada y el escenario es el cuadrado más grande que entra en el alto visible (`container-type: size`). El timeline sigue a la lista de pasos, así cada escena queda quieta mientras su texto cruza el centro. En móvil, el texto del paso activo queda pegado al escenario.
- **Widgets con datos simulados, siempre rotulados:** pulsera en vivo y turno que avanza, llamador tipo TV y una mañana en la guardia en Personas; un gráfico por cifra de mercado, la arquitectura con un corte de internet simulado y la composición del primer año en Instituciones. Avanzan con `liveTicker` (`shared/live-feed.ts`): solo en pantalla, con la pestaña visible, con botón de pausa y en pausa de entrada con movimiento reducido.
- **Fondo de luz en el shell** (`shared/ambient-light.ts`): un canvas fijo con una grilla de puntos tipo monitor, una luz que sigue al cursor (o deriva sola en pantallas táctiles), un latido de luz cada 3 s y tres auroras de marca. Las tarjetas principales suman un brillo que sigue al mouse (`vtSpotlight`). Sin `filter: blur`: con él, Chromium sin GPU caía a 16 fps; sin él, 55 fps.
- **Movimiento con anime.js, siempre a través de `core/motion.ts`:** respeta `prefers-reduced-motion`, no corre sin `IntersectionObserver` (jsdom) y revierte el `Scope` al destruir el componente. Con movimiento reducido, la cámara del recorrido corta de escena en escena en lugar de volar.
- **B2B sin cifras inventadas:** cada dato de mercado lleva su fuente al lado (REFES 2023, Adecra+Cedim, Towards Healthcare). La calculadora usa supuestos editables dentro de los rangos de referencia del monitoreo remoto (HealthArc) y dice que no es una proyección financiera. Los números de rendimiento son los medidos en [10-validacion.md](../10-validacion.md).
- **Sin backend:** el formulario de contacto valida en el cliente y abre el programa de correo con el mensaje armado. La dirección está en `apps/landing/src/app/core/site.ts`.

## Alternativas consideradas

- **Generar los videos de scroll-world:** el resultado es más cinematográfico, pero cuesta unos US$ 27 por cadena, depende de servicios externos y pesa varios MB por escena. Además no se adapta al modo oscuro ni a los textos de la marca.
- **Landing en React o Astro:** el portal cautivo ya usa React, pero sumar otro framework al monorepo duplicaría componentes (logo, tema) y reglas de lint. Angular reutiliza `@vitalia/ui`.
- **Dos apps separadas para B2C y B2B:** duplica el shell, el pie y el despliegue sin ventaja. Con un solo `router-outlet`, cambiar de audiencia es instantáneo.
- **Aplicar ai-design-skills a rajatabla (Geist, Phosphor):** la landing se vería como otro producto que el Backoffice y el portal.
- **Fondo con WebGL o una librería de partículas:** más vistoso, pero suma peso y falla en equipos sin GPU. Un canvas 2D con la grilla precalculada alcanza y se apaga con la pestaña oculta.

## Consecuencias

- `animejs@4.5.0` es una dependencia nueva del workspace. Solo la usa la landing.
- Las cifras de mercado y las referencias de precio tienen fecha (25/10/2026): hay que revisarlas antes de la defensa y con cada uso comercial.
- `SITE.contactEmail` es un marcador (`contacto@vitalia.example`). Hay que reemplazarlo antes de publicar.
- El costo de la pulsera de la calculadora (US$ 35) es un supuesto. Tiene que confirmarse con el costo real de componentes del firmware.
- Contraste AA verificado en claro y oscuro: texto chico en `--vt-muted`, enlaces en `--vt-primary-deep`/`--vt-primary-light` y botón primario en `--vt-primary-deep` (ver [06-identidad-visual](../06-identidad-visual.md#10-landing)).
- El fondo de luz baja su intensidad en pantallas táctiles (0,45) para no competir con el texto, y queda como un cuadro estático con movimiento reducido.
- 41 tests en la landing: cámara y señal del recorrido, modelo de ingresos, intensidad de la luz, `buildMailto` y estados de render de los widgets.
- La landing no corre en el gateway: se publica como sitio estático aparte. Igual mantiene la regla offline-first (fuentes e íconos propios, sin CDN).
