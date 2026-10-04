# @vitalia/contracts

Contratos compartidos del ecosistema Vitalia: tipos de la API REST, eventos WebSocket, tópicos y payloads MQTT, y reglas clínicas puras (umbrales y clasificación de triaje).

- Sin dependencias de framework: se importa igual desde NestJS y Angular.
- Cualquier cambio de contrato se hace **primero acá** y luego en API y frontends.

```ts
import { REALTIME_EVENTS, MQTT_TOPICS, assessVitals } from '@vitalia/contracts';
```

Tests: `pnpm nx test contracts`
