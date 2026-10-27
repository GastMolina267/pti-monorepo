# Registro de decisiones de arquitectura (ADR)

Formato y proceso: skill `vitalia-docs`. Un ADR aceptado no se edita: se reemplaza con uno nuevo.

| #                                                          | Decisión                                                  | Estado             |
| ---------------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| [0001](0001-monorepo-nx.md)                                | Monorepo con Nx y pnpm                                    | Aceptado           |
| [0002](0002-backoffice-en-angular.md)                      | Backoffice y TV en Angular                                | Aceptado           |
| [0003](0003-versiones-alineadas-a-nx.md)                   | Versiones de Angular y NestJS alineadas a Nx 23           | Aceptado           |
| [0004](0004-portal-cautivo-fuera-del-monorepo.md)          | Portal cautivo en su propio repo                          | Aceptado           |
| [0005](0005-orm-prisma.md)                                 | Prisma como ORM                                           | Rechazado (→ 0009) |
| [0006](0006-cifrado-aes-256-gcm.md)                        | AES-256-GCM para la telemetría                            | Aceptado           |
| [0007](0007-tiempo-real-socket-io.md)                      | Socket.IO para tiempo real                                | Aceptado           |
| [0008](0008-contexto-ia-agents-md-y-skills.md)             | AGENTS.md como fuente única + skills                      | Aceptado           |
| [0009](0009-orm-typeorm.md)                                | TypeORM como ORM                                          | Aceptado           |
| [0010](0010-firmware-del-wearable-en-el-monorepo.md)       | Firmware del wearable en el monorepo                      | Aceptado           |
| [0011](0011-identificador-del-wearable.md)                 | Identificador del wearable `wb-<NN>-<mac>`                | Aceptado           |
| [0012](0012-esp-mqtt-en-el-firmware.md)                    | ESP-MQTT en el firmware (QoS 1, outbox)                   | Aceptado           |
| [0013](0013-despliegue-software-gateway.md)                | Despliegue del software con Compose independiente         | Aceptado           |
| [0014](0014-identidades-y-acl-mqtt.md)                     | Identidades individuales y ACL MQTT del gateway           | Aceptado           |
| [0015](0015-recibir-comandos-en-el-firmware.md)            | Recepción MQTT y estado del llamado en el firmware        | Aceptado           |
| [0016](0016-validar-gateway-con-navegadores-reales.md)     | E2E del gateway y snapshots de reconexión                 | Aceptado           |
| [0017](0017-operar-y-recuperar-el-gateway.md)              | Operación, recuperación y respaldos del gateway           | Aceptado           |
| [0018](0018-operacion-de-largo-plazo-y-red-del-gateway.md) | Retención, réplica por outbox y red del gateway           | Aceptado           |
| [0019](0019-app-del-paciente-en-flutter.md)                | App del paciente en Flutter con sesión de turno           | Aceptado           |
| [0020](0020-landing-b2c-b2b.md)                            | Landing con dos audiencias (B2C y B2B)                    | Aceptado           |
| [0021](0021-estado-de-la-pulsera-por-comandos.md)          | Estado de la pulsera por comandos y pantalla del paciente | Aceptado           |
| [0022](0022-gateway-expuesto-por-defecto.md)               | Gateway publicado en la red por defecto                   | Aceptado           |
| [0023](0023-descartar-solo-la-medicion-fuera-de-rango.md)  | Descartar solo la medición fuera de rango                 | Aceptado           |
| [0024](0024-exposicion-publica-con-cloudflare-tunnel.md)   | Exposición pública del gateway con Cloudflare Tunnel      | Aceptado           |
