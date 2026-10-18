# 0013. Desplegar el software del gateway con Compose independiente

- Estado: Aceptado
- Fecha: 2026-10-18
- Autores: Gastón Molina

## Contexto

Fase 4 necesita integrar el software sin depender del portal, router o validación física. El entorno de desarrollo ya tiene PostgreSQL y Mosquitto, y debe poder seguir usándose sin perder sus volúmenes ni ocupar sus puertos.

## Decisión

- Usar `docker-compose.gateway.yml`, proyecto `vitalia-gateway`, con volúmenes propios. Solo Nginx y el broker de simuladores se publican en loopback.
- Generar los Dockerfiles con Nx y adaptarlos a un build multi-stage desde la raíz: Node 24 y pnpm 10.34.6; API compilada y lockfile podado por Nx; frontends compilados por Nx y servidos por Nginx.
- Servir Backoffice y TV en dos orígenes, con proxies a la misma API y Socket.IO. No se cambian los base href ni las rutas de las apps.
- Generar configuración local aleatoria en `.gateway/.env`, conservando cualquier archivo existente. Excluir ese directorio, `.env` y `secrets.h` del contexto Docker.
- Aplicar migraciones al arrancar y ejecutar el seed simulado solo por pedido explícito. Compilar el seed como entry point adicional; no instalar herramientas TypeScript en la imagen final.
- Verificar configuración y arranque mediante targets Nx, tests del inicializador y smoke HTTP/Socket.IO. Auth/ACL del broker continúa en 4b; E2E funcional en 4d.

## Alternativas consideradas

- Extender el Compose de desarrollo: cambia el flujo actual y mezcla volúmenes/puertos.
- Servir las apps en subrutas: exige cambiar base href y rutas absolutas sin aportar valor al prototipo.
- Ejecutar el seed en cada arranque: introduce datos simulados involuntariamente y confunde despliegue con demo.

## Consecuencias

El software se puede levantar y verificar sin hardware. La primera construcción descarga imágenes y paquetes; en ejecución no se depende de CDNs. Este cierre parcial no acredita ni el Hito 3 físico completo ni la prueba sin WAN de Fase 5. La seguridad MQTT se conserva como un entregable pendiente explícito.
