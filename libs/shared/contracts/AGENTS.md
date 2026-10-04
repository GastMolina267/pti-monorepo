# AGENTS.md — libs/shared/contracts (@vitalia/contracts)

**Fuente única de verdad** de los contratos entre API, Backoffice, TV, portal cautivo y firmware. Skill `vitalia-contracts`.

## Reglas

- **TypeScript puro:** solo tipos, `const` y funciones puras. **Prohibido** importar Angular, NestJS, RxJS, Node o cualquier dependencia de runtime.
- Organización por dominio: `src/lib/{api,realtime,telemetry,clinical}/` con un `index.ts` por carpeta, reexportado en `src/index.ts`.
- Constantes con `as const` y tipos derivados (`(typeof X)[keyof typeof X]`).
- Toda función tiene test en vitest (`*.spec.ts` al lado).
- Cambiar un contrato es un **cambio que puede romper**: actualizar API y frontends en el mismo PR, y además [`docs/04-contratos.md`](../../../docs/04-contratos.md).
- Los umbrales clínicos vienen de la tesis (§5.1.1, §8.4). Si cambian, citar la fuente en el comentario.
