# 0003. Versiones de Angular y NestJS alineadas a Nx 23

- Estado: Aceptado
- Fecha: 2026-10-03

## Contexto

Al crear el workspace ya existía NestJS 12, pero el plugin `@nx/nest` 23 instala y soporta NestJS 11. Angular quedó en 22.1 (lo que soporta `@nx/angular` 23).

## Decisión

Usar las versiones que gestiona Nx: **Angular 22**, **NestJS 11**, TypeScript 6. Actualizar solo con `pnpm nx migrate`.

## Consecuencias

- (+) Generadores, executors y migraciones automáticas funcionan sin fricción.
- (−) NestJS 12 se adopta cuando Nx lo soporte (`nx migrate`).
