# infra/

Configuración de la infraestructura del **Edge Gateway (Fog Node)**.

| Carpeta             | Contenido                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `mosquitto/config/` | Configuración del broker MQTT (Eclipse Mosquitto 2)                                                       |
| `postgres/`         | Scripts de inicialización de PostgreSQL 16 (vacío por ahora; el esquema lo maneja el ORM desde la Fase 1) |

El `docker-compose.yml` de la raíz levanta estos servicios: `pnpm infra:up`.

Planificado (Fase 4): `nginx/` (reverse proxy para API, Backoffice, TV y portal cautivo), Dockerfile de la API y perfiles de despliegue en el gateway (Mini PC N100 / Raspberry Pi 5).
