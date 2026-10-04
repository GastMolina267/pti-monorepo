# 0002. Backoffice y llamador TV en Angular

- Estado: Aceptado
- Fecha: 2026-10-03

## Contexto

La tesis (§8.3, §9.3) define Angular para la consola médica y el llamador de TV. El portal cautivo ya existente está en React.

## Decisión

`apps/backoffice` y `apps/tv-display` en **Angular 22** (standalone, zoneless, signals) con **Angular Material M3** con el tema Vitalia.

## Alternativas consideradas

- **React + MUI:** reutilizaría componentes del portal, pero se aparta de la tesis.

## Consecuencias

- (+) Respeta la tesis. Angular Material aporta componentes accesibles para una consola de datos.
- (−) No se comparten componentes con el portal (React). Se comparten los **tokens de diseño** (mismos valores) y los **contratos** (TS puro).
