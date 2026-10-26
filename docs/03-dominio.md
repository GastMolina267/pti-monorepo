# 03 · Dominio

## Glosario

| Término (es)            | Código (en)        | Definición                                                           |
| ----------------------- | ------------------ | -------------------------------------------------------------------- |
| Paciente                | `Patient`          | Persona en atención. Datos mínimos; en desarrollo, siempre simulados |
| Turno                   | `Ticket`           | Lugar en la fila. Código visible `A-024` (`ticketCode`)              |
| Fila de espera          | `Queue`            | Turnos en espera, ordenados por prioridad clínica y por llegada      |
| Consultorio             | `ConsultingRoom`   | Destino del llamado                                                  |
| Check-in                | `CheckIn`          | Registro de llegada (portal cautivo al conectarse al Wi-Fi o kiosk)  |
| Llamado                 | `TicketCall`       | Acción del profesional que convoca un turno                          |
| Wearable / pulsera      | `Wearable`         | Dispositivo ESP32-C3 asignado a un paciente durante la espera        |
| Lectura biométrica      | `TelemetryReading` | FC (BPM), SpO₂ (%), temperatura (°C), aceleración pico (g), caída    |
| Alerta                  | `Alert`            | Evento clínico que requiere atención (caída, hipoxia, taquicardia…)  |
| Nivel de triaje         | `TriageLevel`      | `STABLE` (Estable) · `ATTENTION` (Atención) · `CRITICAL` (Crítico)   |
| Edge Gateway / nodo Fog | —                  | Servidor local con Docker que corre todo el backend                  |

## Umbrales clínicos

Implementados en `@vitalia/contracts` (`CLINICAL_THRESHOLDS`, `assessVitals`). Valores de referencia de la tesis (§5.1.1, §8.4). **Prototipo académico, no certificado.**

| Variable                       | Normal     | Atención           | Crítico                                                  |
| ------------------------------ | ---------- | ------------------ | -------------------------------------------------------- |
| Frecuencia cardíaca            | 60–100 BPM | < 60 o > 100       | < 40 o > 130                                             |
| SpO₂                           | ≥ 95 %     | 90–94 %            | < 90 % (hipoxia)                                         |
| Temperatura (clínica estimada) | ≤ 37,5 °C  | > 37,5 °C (fiebre) | > 39,5 °C o < 35 °C                                      |
| Caída                          | —          | —                  | Impacto > 2,8 g + inmovilidad (detectada en el wearable) |

El firmware compensa la temperatura de la piel de la muñeca (31–34 °C) para estimar la temperatura central. Frecuencia de muestreo: 50 Hz (PPG e inercial). Publicación cada ~3 s.

## Requerimientos funcionales

| ID    | Requerimiento                                                   | Proyecto(s)                   | Fase         |
| ----- | --------------------------------------------------------------- | ----------------------------- | ------------ |
| RF-O1 | Muestreo biométrico continuo (FC, SpO₂, temperatura)            | Firmware                      | Hardware     |
| RF-O2 | Detección algorítmica de caídas (MPU6050)                       | Firmware → `api/telemetry`    | Hardware / 2 |
| RF-O3 | Transmisión cifrada por MQTT (JSON + AES-256)                   | Firmware, `api/telemetry`     | 2            |
| RF-O4 | Consola de triaje: fila priorizada + alertas visuales y sonoras | `backoffice`                  | 3            |
| RF-O5 | Check-in y autogestión de turnos al conectarse al Wi-Fi         | Portal cautivo, `api/tickets` | 1 / 4        |
| RF-O6 | Persistencia local de contingencia en PostgreSQL                | `api`                         | 1            |
| RF-D1 | Notificaciones push web de proximidad del turno                 | Portal/PWA                    | Opcional     |
| RF-D2 | Modo repetidor mesh (ESP-WIFI-MESH)                             | Firmware                      | Opcional     |
| RF-D3 | Exportación de reportes PDF con la curva biométrica             | `backoffice` / `api`          | Opcional     |

## Requerimientos no funcionales

| ID     | Requerimiento                                | Cómo se cumple                                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RNF-O1 | Alerta en ≤ 2 s (objetivo < 500 ms)          | Camino MQTT → WS sin bloqueos; medido en 5c: p95 6 ms con 50 pulseras ([10-validacion](10-validacion.md)). Se mide desde la detección en el wearable: una caída se confirma ~2,5 s después del impacto (inmovilidad, `config.h` del firmware) y se publica en el momento |
| RNF-O2 | 24 h de operación sin WAN                    | Todo local (Fog), sin CDNs, fuentes y íconos auto-hospedados; cambios a la nube por outbox (ADR 0018); 0 pedidos externos en 5c                                                                                                                                          |
| RNF-O3 | Datos médicos cifrados con AES-256           | AES-256-GCM en el wearable y descifrado en `api/telemetry`                                                                                                                                                                                                               |
| RNF-O4 | UIs responsivas                              | Layouts fluidos, probados de 360 px a escritorio                                                                                                                                                                                                                         |
| RNF-D1 | Firmware preparado para deep sleep y batería | Firmware                                                                                                                                                                                                                                                                 |
| RNF-D2 | App de turnos en español e inglés            | Portal / i18n (opcional)                                                                                                                                                                                                                                                 |

## Reglas de negocio

- La fila se ordena por **nivel de triaje** (crítico primero) y después por **hora de check-in**.
- Una alerta crítica queda activa hasta que un miembro del personal la **reconoce** (`alert:acknowledged`).
- Un wearable se asigna a **un** turno activo a la vez y se libera cuando el turno pasa a `DONE` o `NO_SHOW`.
- Las lecturas de telemetría se borran pasadas 72 h (`TELEMETRY_RETENTION_HOURS`, [ADR 0018](adr/0018-operacion-de-largo-plazo-y-red-del-gateway.md)). A la nube solo viajan turnos y alertas minimizados, sin DNI.
