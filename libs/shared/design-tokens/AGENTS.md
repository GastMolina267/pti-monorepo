# AGENTS.md — libs/shared/design-tokens (@vitalia/design-tokens)

Identidad visual **Vitalia** en código. Es el **único lugar** donde pueden aparecer los hex de la marca. Skill `vitalia-design-system`, guía en [`docs/06-identidad-visual.md`](../../../docs/06-identidad-visual.md).

- `src/styles/_tokens.scss`: CSS custom properties `--vt-*` (claro/oscuro). Si agregás un token, va en ambos modos.
- `src/styles/_material.scss`: tema Angular Material M3 + overrides de la marca.
- `src/styles/_base.scss`: base y utilidades `.vt-*`.
- `src/lib/brand.ts`: los mismos valores en TS. **Tiene que estar sincronizado con `_tokens.scss`.**
- `src/assets/`: isotipo y favicon. Las apps los copian a `/brand`.
- La identidad es compartida con el portal cautivo (React). Cualquier cambio de marca se replica allá.
