# 0015. Recibir comandos MQTT y mostrar el llamado desde el loop del firmware

- Estado: Aceptado
- Fecha: 2026-10-18
- Autores: Gastón Molina

## Contexto

La API publica `SHOW_TICKET` desde Fase 2, pero el firmware solo enviaba lecturas. La Fase 4c debe completar el receptor y el estado del OLED como software, sin exigir placa, sensores nuevos ni flasheo. ESP-MQTT ejecuta sus eventos en una tarea distinta del `loop()` que comparte I²C entre pantalla y sensores.

## Decisión

- Suscribirse con QoS 1 a `hospital/+/wearable/<código propio>/cmd` en cada `MQTT_EVENT_CONNECTED`. El comodín de sala cubre el fallback `sala1` de la API y cambios de sala; el dispositivo nunca acepta otro código ni otro sufijo.
- Reensamblar los fragmentos contiguos de una publicación, con tamaño acotado. Descartar recepciones incompletas al desconectar, mensajes retenidos y entradas inválidas sin alterar el último llamado válido. El manejo de fragmentos sigue los campos de [ESP-MQTT 4.4](https://docs.espressif.com/projects/esp-idf/en/v4.4/esp32/api-reference/protocols/mqtt.html).
- Mantener los tipos, tópicos y límites en `@vitalia/contracts` y generar las constantes C++. El payload JSON existente no cambia: objeto `SHOW_TICKET`, `ticketCode` y `consultingRoom`. Validar tipos, campos, UTF-8, ausencia de controles y límites de bytes antes de copiar al estado.
- Pasar una copia del último comando válido al `loop()` mediante una cola FreeRTOS de un elemento. El callback de red no usa OLED, Wire ni sensores; si llegan varios llamados antes de consumir, gana el más reciente.
- Conservar el llamado en RAM hasta reemplazo o reinicio; un duplicado idéntico no reinicia el desplazamiento. Mostrar el código y el consultorio con desplazamiento horizontal, transliterando tildes/ñ para la fuente básica del SSD1306. Una caída reciente tiene prioridad temporal; sin broker se conserva el llamado con la indicación `SIN RED`.
- Testear parser, fragmentos, estado y presentación como C++ puro; compilar el adaptador MQTT real contra stubs mínimos del SDK para probar conexión/SUBACK/reconexión y la cola. Compilar además con el SDK real para ESP32-C3. Docker permite hacerlo sin instalar PlatformIO o GCC en el host y usa únicamente la plantilla de secretos.

## Alternativas consideradas

- Escribir el OLED en el callback MQTT: puede competir por I²C con sensores y bloquear la tarea de red.
- Suscribirse solo a la sala configurada: pierde el llamado que la API envía a `sala1` antes de recibir la primera lectura de otra sala.
- Mostrar mensajes retenidos: puede reabrir un llamado viejo después de reiniciar o reasignar una pulsera.
- Reemplazar el JSON o agregar confirmaciones de negocio: no hace falta para recibir el contrato vigente; requeriría coordinar API y otros clientes.

## Consecuencias

Se completa la recepción como software, con memoria y buffers acotados. No se agrega un comando de limpieza ni sincronización de llamados perdidos mientras el dispositivo estaba desconectado: QoS 1 y resuscripción no equivalen a recuperar el estado de negocio. El último llamado puede seguir visible después de finalizar un turno; esa semántica necesita un contrato futuro. Se conserva el diagnóstico de sensores cuando no hay llamado y se prioriza una caída local reciente. Las pruebas no acreditan el funcionamiento físico del OLED, la red ni el hardware.
