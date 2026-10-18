# 0016. Validar el gateway con navegadores reales y snapshots de reconexión

- Estado: Aceptado
- Fecha: 2026-10-18
- Autores: Gastón Molina

## Contexto

Los tests de API con broker en proceso y los smoke de 4a–4b no verifican que las interfaces compiladas, Nginx, Mosquitto y PostgreSQL funcionen juntos. La Fase 4d pide completar el recorrido de software y comprobar lo que pasa cuando Backoffice y TV pierden eventos.

El E2E reprodujo una alerta reconocida durante un corte que seguía activa al reconectar: `AlertsStore` conservaba cualquier alerta reciente durante diez segundos, aunque el snapshot ya no la incluyera. Las regresiones también encontraron respuestas HTTP viejas que reactivaban alertas reconocidas o sobrescribían una consulta posterior.

## Decisión

- Usar Playwright/Chromium como dependencia de desarrollo, con un target Nx explícito contra el gateway Docker ya levantado y sembrado. Los browsers están aislados del navegador del usuario; no se mockean API, cifrado, base, MQTT ni eventos de negocio.
- Crear turnos simulados sin DNI y usar una pulsera simulada libre con credenciales individuales. Reservar la sala `e2e-4d`. Reconocer alertas y cerrar solamente los turnos de esa corrida en `finally`; conservar el historial y los datos existentes.
- Probar desde UI el login, la asignación, el reconocimiento y el llamado. Un cliente MQTT publica sobres AES-GCM reales y recibe `SHOW_TICKET`. La TV real verifica el llamado sin datos clínicos.
- Cortar HTTP/WebSocket de ambos contextos de navegador, conservando Node/REST y Mosquitto conectados. Reconocer una alerta, publicar otra y llamar el turno durante el corte; al volver exigir snapshots HTTP y estado visible actualizado **sin recargar** las páginas. También reconectar el cliente MQTT y comprobar la recepción del nuevo comando.
- Reconciliar alertas por identidad y versión de consulta: conservar eventos recibidos durante el pedido, quitar las conocidas ausentes del snapshot, ignorar respuestas anteriores y filtrar IDs reconocidos en la sesión. Reemplazar la heurística temporal de diez segundos.
- Mantener snapshots y sesión de prueba en memoria. No guardar JWT, contraseñas ni trazas de login; capturas de fallos y resultados quedan en `.gateway/`, ignorado por Git. Integrar instalación del browser, typecheck y E2E en el job CI del gateway.

## Alternativas consideradas

- Solo `socket.io-client` y REST: valida protocolos pero no el comportamiento de Angular ni la presentación en TV.
- Reutilizar la base destructiva de `app.int.spec.ts`: no prueba las imágenes de producción y borra el estado del despliegue.
- Agregar pausas fijas o retries automáticos al recorrido: pueden ocultar carreras y duplicar acciones. Se usan expectativas sobre estados observables y una sola ejecución por worker.

## Consecuencias

El recorrido es repetible en Windows y CI con Chromium. Necesita un gateway sembrado y una pulsera simulada disponible; deja historial de prueba identificado, cerrado y reconocido. La primera instalación descarga el browser, pero la aplicación desplegada sigue usando recursos locales. Los cortes son de los clientes, no una prueba de caída del gateway ni de WAN durante 24 horas; carga, latencias certificadas y hardware siguen fuera de 4d. El cliente de prueba representa el wearable, sin ejecutar el binario C++ ni un OLED físico.
