# 0014. Separar identidades y permisos MQTT en el gateway

- Estado: Aceptado
- Fecha: 2026-10-18
- Autores: Gastón Molina

## Contexto

El gateway de 4a usa el broker anónimo de desarrollo. El cifrado AES-GCM protege las lecturas, pero por sí solo no impide publicar en tópicos ajenos o inyectar comandos `SHOW_TICKET`. La fase 4b debe cerrar estos accesos y poder probarse con simuladores, sin router ni placa.

## Decisión

- Usar una configuración Mosquitto propia del gateway, con `allow_anonymous false`, usuario API y usuario health separados, y un usuario por código de pulsera.
- Generar ACL explícitas por usuario. La API solo lee datos y escribe comandos; health solo lee uptime; cada pulsera solo escribe sus datos y lee sus comandos en cualquier sala. No usar patrones globales `%u`, que también alcanzarían a las cuentas de servicio.
- Aprovisionar secretos locales en `.gateway/`, fuera de Git e imágenes. Conservar los existentes, agregar dispositivos explícitamente y respetar bajas del archivo local. El contrato puro `WearableMqttPasswords` comparte la validación entre aprovisionador y simulador.
- Hashear con `mosquitto_passwd` en un contenedor temporal y montar únicamente hashes y ACL en el broker. Recrear el stack al aplicar cambios para cerrar sesiones antiguas y recargar permisos.
- Dar prioridad a `.gateway/.env` sobre las variables dev heredadas por Nx en todos los comandos de Compose del gateway.
- Probar contra Mosquitto real: rechazos de conexión, denegación de publicaciones QoS 1 con MQTT 5 y filtrado de entregas a suscripciones amplias. Un SUBACK aceptado no demuestra acceso de lectura.

## Alternativas consideradas

- Un usuario para todas las pulseras: no permite aislar ni revocar un dispositivo.
- ACL global `pattern ... %u`: da permisos adicionales a cuentas API/health con esos nombres.
- Compilar contraseñas en la imagen: dificulta rotación y expone secretos en capas y repositorios.
- Aprovisionamiento automático al dar de alta en la API: agrega permisos Docker y acoplamiento operativo innecesario; el alta funcional y la identidad MQTT son pasos explícitos por ahora.

## Consecuencias

Los simuladores usan credenciales individuales con `--gateway`; el broker dev se conserva separado. Los payloads MQTT, REST y WebSocket no cambian. La rotación o revocación exige recrear el stack y actualizar el cliente; hay una interrupción breve y los datos permanecen en sus volúmenes. Los secretos locales requieren protección del sistema operativo. El gateway sigue publicado en loopback y usa TCP sin TLS; abrirlo a la red requiere otra decisión de despliegue. No se acredita hardware, aislamiento de VLAN ni operación de red con esta entrega.
