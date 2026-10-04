# AGENTS.md — libs/shared/ui (@vitalia/ui)

Componentes Angular **genéricos y de marca** compartidos por Backoffice y TV (logo, tema, y en el futuro: badge de triaje, tarjeta de signos vitales, etc.).

- Solo presentación: nada de llamadas HTTP ni conocimiento de rutas. La lógica de dominio pura viene de `@vitalia/contracts`.
- Standalone, `OnPush`, `input()`, selector `vt-*`, estilos con tokens `--vt-*`.
- Cada componente con su spec (vitest + TestBed) y exportado en `src/index.ts`.
- Si un componente solo lo usa una app, va en esa app, no acá.
