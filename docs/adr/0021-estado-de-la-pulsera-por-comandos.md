# 0021. Estado de la pulsera por comandos y pantalla del paciente en el OLED

- Estado: Aceptado
- Fecha: 2026-10-26
- Autores: Facundo Gomez Geneiro

## Contexto

En la demo del 26/10 con la pulsera física (`wb-01-24d7cc`) contra el gateway, se vieron dos problemas:

1. **El llamado no se borraba.** La API solo publicaba `SHOW_TICKET`. Al finalizar el turno, el OLED seguía mostrando `TE LLAMAN`. El ADR 0015 lo dejaba como consecuencia abierta: "esa semántica necesita un contrato futuro".
2. **La pantalla sin llamado era de diagnóstico** (IP, temperatura y aceleración). Después del triaje el paciente sigue con la pulsera hasta que lo atienden, y mientras espera conviene que vea sus propios valores en vivo. Igual quedan registrados en el gateway.

Restricciones:

- Los comandos viajan **en claro** por MQTT, con la promesa del contrato de no llevar datos personales (Ley 25.326). Además, el OLED lo puede ver cualquiera en la sala.
- La cola del firmware hacia el `loop()` tiene un solo lugar y gana el último comando (ADR 0015).
- Los comandos van sin retain: una pulsera que reinicia o estuvo desconectada no recibe lo que se publicó mientras tanto.

## Decisión

- **Cuatro comandos, cada uno con el estado completo de la pulsera**, para que aplicar solo el último siempre deje el estado correcto:
  - `ASSIGN_TICKET { ticketCode }`: asignada a un turno no llamado.
  - `SHOW_TICKET { ticketCode, consultingRoom }`: llamado (sin cambios).
  - `CLEAR_TICKET { ticketCode }`: el turno dejó de estar llamado. El firmware lo ignora si no es su llamado, para que uno viejo o desordenado no borre uno nuevo.
  - `RELEASE_WEARABLE {}`: libre.
- **La API los publica** al asignar, cuando el turno sale de `CALLED` (en atención, de vuelta a la fila, ausente) y al liberar la pulsera (a mano, o al finalizar o cancelar el turno).
- **Reenvío del estado:** si una pulsera vuelve a publicar después de más de 15 s sin lecturas (publica cada 3 s; un reinicio tarda más de 10 s), la API le reenvía su estado actual. Cubre reinicios y cortes sin guardar mensajes en el broker.
- **Vencimiento local:** el firmware termina un llamado que lleva 30 min, por si el `CLEAR_TICKET` se perdió y la pulsera no volvió a desconectarse.
- **Pantalla del paciente** cuando no hay llamado:
  - `Turno <código>` (o `Vitalia` libre), con `SIN RED` si no hay broker;
  - BPM y SpO2 en vivo (o `--` si no hay medición válida);
  - temperatura estimada (con `FIEBRE` sobre 38 °C, el indicador local existente).
- **Prioridad:** caída reciente > llamado > paciente.
- **Sin el nombre del paciente:** se muestra el **código del turno**, que es lo que anuncia la TV. La IP sale del OLED: queda en el monitor serie, `/status` y mDNS.

## Alternativas consideradas

- **Mostrar el nombre del paciente:** es lo más claro para el paciente, pero obliga a mandar un dato personal en claro y lo deja visible en la muñeca. Se descartó.
- **Solo vencimiento por tiempo**, sin `CLEAR_TICKET`: no distingue "lo atendieron" de "todavía no fue". El llamado quedaría hasta 30 min de más o se borraría antes.
- **Un único comando de estado que reemplace a `SHOW_TICKET`:** rompería el contrato vigente y los firmwares ya flasheados. Los comandos nuevos son aditivos, porque un tipo desconocido se ignora.
- **Mensajes retenidos en el broker:** ADR 0015 los descarta, porque reabren llamados viejos al reasignar una pulsera. El reenvío desde la API usa el estado actual de la base.

## Consecuencias

- El llamado se borra cuando corresponde y la pulsera muestra su turno y sus signos en vivo. Después de un reinicio, recupera turno y llamado en la primera lectura.
- Cambian el contrato (`WearableCommand`), la API (`wearables`, `tickets`, `telemetry`), el firmware (`lib/commands`, `main.cpp`) y el E2E del gateway. Todo con tests: integración con los cuatro comandos, unitarios del reenvío, native del parser, el estado y la pantalla.
- El paciente ve sus valores sin interpretación clínica. La alerta la sigue decidiendo la API con `assessVitals()`.
- No se agrega cifrado a los comandos. Si en el futuro hiciera falta mostrar datos personales, primero hay que cifrarlos (otra decisión).
