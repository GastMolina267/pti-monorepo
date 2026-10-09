# 08 · Modelo de datos

PostgreSQL 16 con **TypeORM** ([ADR 0009](adr/0009-orm-typeorm.md)). Las entidades viven en `apps/api/src/modules/<dominio>/entities/`, el registro único en `apps/api/src/database/entities.ts` y las migraciones en `apps/api/src/database/migrations/`.

## Diagrama entidad-relación

```mermaid
erDiagram
  staff_users ||--o{ tickets : "llama (called_by)"
  staff_users ||--o{ alerts : "reconoce"
  service_areas ||--o{ tickets : "numera"
  consulting_rooms ||--o{ tickets : "atiende"
  patients ||--o{ tickets : "tiene"
  tickets ||--o| wearables : "usa (1 a la vez)"
  tickets ||--o{ telemetry_readings : ""
  tickets ||--o{ alerts : ""
  wearables ||--o{ telemetry_readings : "publica"
  wearables ||--o{ alerts : "origina"

  staff_users {
    uuid id PK
    varchar email UK
    varchar full_name
    varchar password_hash "bcrypt, nunca se expone"
    staff_role role "ADMIN|NURSE|DOCTOR|RECEPTION"
    boolean active
  }
  service_areas {
    uuid id PK
    varchar code UK "CLINICA, GUARDIA…"
    varchar name
    varchar prefix UK "A, B, C → A-024"
  }
  consulting_rooms {
    uuid id PK
    varchar code UK "C4"
    varchar name "Consultorio 4"
    varchar specialty
  }
  patients {
    uuid id PK
    varchar first_name
    varchar last_name
    varchar document_number UK "DNI opcional"
  }
  tickets {
    uuid id PK
    varchar code "A-024"
    int number
    varchar day_key "YYYY-MM-DD (AR)"
    ticket_status status
    triage_level triage_level
    check_in_source source
    uuid service_id FK
    uuid patient_id FK
    uuid consulting_room_id FK
    uuid called_by_id FK
    timestamptz checked_in_at
    timestamptz called_at
    timestamptz started_at
    timestamptz finished_at
  }
  wearables {
    uuid id PK
    varchar code UK "wb-07-24d7cc (tópico MQTT, ADR 0011)"
    wearable_status status
    uuid ticket_id FK,UK
    timestamptz last_seen_at
  }
  telemetry_readings {
    bigint id PK
    uuid wearable_id FK
    uuid ticket_id FK
    int seq
    timestamptz measured_at
    smallint heart_rate
    smallint spo2
    numeric temperature
    numeric acc_peak_g
    boolean fall
    triage_level triage_level
  }
  alerts {
    uuid id PK
    alert_kind kind
    triage_level level
    alert_status status
    varchar message
    uuid wearable_id FK
    uuid ticket_id FK
    timestamptz detected_at
    timestamptz acknowledged_at
  }
```

## Reglas del modelo

| Regla                                                                             | Implementación                                                                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| La numeración de turnos reinicia por servicio y día operativo (hora de Argentina) | `UNIQUE (service_id, day_key, number)`, con reintento ante colisión en el check-in       |
| Una pulsera se asigna a un solo turno a la vez                                    | `wearables.ticket_id UNIQUE`                                                             |
| La fila se consulta por estado, triaje y llegada                                  | Índice `ix_tickets_queue (status, triage_level, checked_in_at)`                          |
| La telemetría se consulta por pulsera o turno en el tiempo                        | Índices `(wearable_id, measured_at)` y `(ticket_id, measured_at)`                        |
| Datos mínimos del paciente (Ley 25.326)                                           | Solo nombre, apellido y DNI opcional. Las respuestas muestran `displayName` ("Lucía G.") |
| Contraseñas                                                                       | Hash bcrypt (`password_hash`, `select: false`)                                           |
| IDs                                                                               | `uuid` con `gen_random_uuid()`. Las lecturas usan `bigint` autoincremental por volumen   |

Los enums de PostgreSQL (`staff_role`, `ticket_status`, `triage_level`, `check_in_source`, `wearable_status`, `alert_kind`, `alert_status`) usan los mismos valores que `@vitalia/contracts`.

## Tablas por fase

| Tabla                                                                     | Se usa desde                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `staff_users`, `service_areas`, `consulting_rooms`, `patients`, `tickets` | Fase 1 ✅                                      |
| `wearables`, `telemetry_readings`, `alerts`                               | Fase 2 (ya creadas; el seed asigna 4 pulseras) |

## Comandos

```bash
pnpm db:migrate                      # aplicar migraciones pendientes
pnpm db:generate --name=AddXxx       # generar migración por diff (revisarla y registrarla en migrations/index.ts)
pnpm db:revert                       # revertir la última
pnpm db:show                         # estado de las migraciones
pnpm db:seed                         # datos simulados (idempotente)
pnpm db:reset                        # drop + migrate + seed (solo desarrollo)
```

## Datos del seed (desarrollo)

| Tipo                            | Datos                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Servicios                       | `CLINICA` (A) · `GUARDIA` (B) · `PEDIATRIA` (C)                                                                     |
| Consultorios                    | C1–C4 y G1 (Box de Guardia)                                                                                         |
| Usuarios (clave `Vitalia2026!`) | `admin@`, `enfermeria@`, `medico@`, `pediatria@`, `recepcion@` + `vitalia.local`                                    |
| Wearables                       | `wb-01-24d7cc` (pulsera real) y `wb-02-5e0002` … `wb-08-5e0008` (simuladas); cuatro asignadas a pacientes en espera |
| Turnos del día                  | 14 en distintos estados y niveles de triaje                                                                         |
