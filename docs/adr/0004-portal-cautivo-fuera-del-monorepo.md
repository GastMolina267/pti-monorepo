# 0004. Portal cautivo en su propio repositorio

- Estado: Aceptado
- Fecha: 2026-10-03

## Contexto

El portal cautivo (`pti-captive-portal`, React + Vite) ya está funcionando con el router RUT956 (UAM/CHAP) y tiene su propio ciclo de vida.

## Decisión

Mantenerlo **fuera** del monorepo. Se integra por contrato HTTP con la API ([docs/04-contratos.md](../04-contratos.md)) y comparte la identidad visual por convención.

## Consecuencias

- (+) No se arriesga algo que ya funciona.
- (−) Los contratos se duplican del lado del portal: cualquier cambio en `@vitalia/contracts` que lo afecte hay que replicarlo a mano. Se puede revisar más adelante (moverlo a `apps/captive-portal` con `nx import`).
