---
name: vitalia-docs
description: Mantener la documentación viva del monorepo Vitalia - registrar decisiones de arquitectura (ADR), actualizar el roadmap por fases, docs técnicas (arquitectura, contratos, dominio, stack), AGENTS.md de cada proyecto y el changelog. Usala al terminar una tarea, al tomar una decisión técnica, al cambiar un contrato o la estructura, o cuando pidan documentar o planificar.
---

# Documentación viva

La documentación es parte del entregable del PTI (memoria técnica) y **el contexto que usan las IAs**. Si queda desactualizada, las próximas sesiones trabajan con información falsa.

## Qué actualizar según el cambio

| Cambio | Archivo(s) |
| --- | --- |
| Terminaste o empezaste una tarea del plan | `docs/07-roadmap.md` (checkbox y estado de la fase) |
| Decisión técnica (librería, patrón, trade-off) | Nuevo `docs/adr/NNNN-titulo.md` + índice en `docs/adr/README.md` |
| Endpoint, evento WS o tópico MQTT | `docs/04-contratos.md` |
| Nuevo módulo, app o lib, o cambio de estructura | `docs/01-arquitectura.md` + `AGENTS.md` raíz (mapa) + `AGENTS.md` del proyecto |
| Nueva dependencia relevante o versión | `docs/02-stack.md` |
| Regla de negocio o umbral clínico | `docs/03-dominio.md` (y `@vitalia/contracts`) |
| Nueva convención | `docs/05-convenciones.md` y, si aplica, la regla de oro en `AGENTS.md` |
| Skill nueva o modificada | `.agents/skills/<skill>/SKILL.md`, después `pnpm ai:sync` + tabla de skills en `AGENTS.md` |

## Plantilla de ADR

```md
# NNNN. Título en infinitivo (ej. "Usar Prisma como ORM")

- Estado: Propuesto | Aceptado | Reemplazado por NNNN
- Fecha: AAAA-MM-DD
- Autores: …

## Contexto
Qué problema o fuerza obliga a decidir. Requerimientos involucrados (RF/RNF).

## Decisión
Qué se decidió, concreto.

## Alternativas consideradas
- Opción B — por qué no.

## Consecuencias
Positivas, negativas y lo que cambia en el código o la tesis.
```

Numeración correlativa con 4 dígitos. Un ADR aceptado no se edita: se reemplaza con uno nuevo.

## Estilo

- Español rioplatense, claro y directo. Tablas para comparar y listas cortas.
- Diagramas en **Mermaid** dentro del markdown (GitHub los renderiza).
- Rutas relativas en los links entre docs.
- Si algo contradice la tesis, anotalo explícitamente ("Diferencia con la tesis: …") para actualizar la memoria final.

## Commits de documentación

`docs(<área>): …` → por ejemplo `docs(roadmap): marcar fase 1 como completada`, `docs(adr): 0006 usar socket.io`.
