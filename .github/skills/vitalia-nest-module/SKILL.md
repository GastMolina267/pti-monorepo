---
name: vitalia-nest-module
description: Crear o extender un módulo de dominio, endpoint REST, servicio o variable de configuración en la API NestJS (apps/api). Usala para cualquier trabajo de backend - nuevos recursos (pacientes, turnos, consultorios, wearables, alertas, auth), endpoints, validación, Swagger, configuración o tests de la API.
---

# Módulo de dominio en la API (NestJS 11)

## 1. Contrato primero

Definí los tipos en `@vitalia/contracts` (skill `vitalia-contracts`).

## 2. Generá el esqueleto con Nx

```bash
pnpm nx g @nx/nest:resource apps/api/src/modules/<dominio>/<dominio> --type=rest --crud=true --no-interactive
# crea module, controller, service, dto/ y specs en apps/api/src/modules/<dominio>/
# o por partes:
pnpm nx g @nx/nest:module apps/api/src/modules/<dominio>/<dominio>
pnpm nx g @nx/nest:controller apps/api/src/modules/<dominio>/<dominio>
pnpm nx g @nx/nest:service apps/api/src/modules/<dominio>/<dominio>
```

Importá el módulo a mano en `apps/api/src/app/app.module.ts` (el generador no lo hace). Borrá `entities/` si no aplica: la persistencia la define el ORM (Fase 1).

## 3. Estructura objetivo

```
modules/tickets/
  tickets.module.ts
  tickets.controller.ts        # HTTP only
  tickets.service.ts           # negocio
  dto/create-ticket.dto.ts     # class-validator + Swagger, implements CreateTicketRequest
  dto/ticket.dto.ts
  tickets.controller.spec.ts
  tickets.service.spec.ts
```

## 4. Plantillas

```ts
// dto/create-ticket.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { TICKET_PRIORITIES, type CreateTicketRequest, type TicketPriority } from '@vitalia/contracts';

export class CreateTicketDto implements CreateTicketRequest {
  @ApiProperty({ example: 'Clínica Médica' })
  @IsString() @Length(2, 60)
  specialty!: string;

  @ApiProperty({ enum: TICKET_PRIORITIES, required: false })
  @IsOptional() @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;
}
```

```ts
// tickets.controller.ts
@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Emitir un turno' })
  @ApiCreatedResponse({ type: TicketDto })
  create(@Body() dto: CreateTicketDto): Promise<TicketDto> {
    return this.tickets.create(dto);
  }
}
```

## 5. Reglas

- La config **solo** con `ConfigService<Env, true>`. Una variable nueva se agrega en `src/config/env.schema.ts` (zod) **y** en `.env.example`.
- Los controllers no tienen lógica. Los services no conocen `Request`/`Response`.
- Errores con excepciones de Nest (`NotFoundException('Turno no encontrado')`), mensajes en español.
- Nombres de eventos y tópicos desde `@vitalia/contracts`, nunca strings sueltos.
- Si emite tiempo real, inyectá el gateway (skill `vitalia-realtime`). Si consume MQTT, ver `vitalia-mqtt-telemetry`.
- Persistencia: el ORM entra en la **Fase 1** (propuesta: Prisma, ver `docs/adr/0005-orm.md`). Hasta entonces, repositorios en memoria detrás de una interfaz.
- Endpoints de staff protegidos con JWT (Fase 1). Los del portal o el kiosk son públicos pero con rate limit.

## 6. Tests (jest)

```ts
const moduleRef = await Test.createTestingModule({
  controllers: [TicketsController],
  providers: [{ provide: TicketsService, useValue: { create: jest.fn() } }],
}).compile();
```

Cubrí: camino feliz, validación (DTO inválido → 400) y casos de negocio (fila vacía, turno inexistente).

## 7. Cierre

- [ ] Swagger se ve bien en `http://localhost:3000/api/docs`
- [ ] `pnpm nx affected -t lint test build` en verde
- [ ] `docs/04-contratos.md` actualizado y tarea marcada en `docs/07-roadmap.md`
