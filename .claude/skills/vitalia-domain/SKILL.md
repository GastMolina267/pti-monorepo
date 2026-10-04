---
name: vitalia-domain
description: Contexto de dominio del Ecosistema Digital Hospitalario Vitalia (turnos, triaje, signos vitales, caídas, alertas, wearables IoMT, red con VLANs, Edge Gateway offline). Usala ANTES de diseñar o implementar cualquier feature que toque pacientes, turnos, consultorios, telemetría, alertas, el portal cautivo o la red del hospital.
---

# Dominio Vitalia

Usá este conocimiento para que las features respeten el problema real y los requerimientos de la tesis. Fuente completa: `docs/00-vision.md`, `docs/03-dominio.md` y el PDF de la tesis (Proyecto PTI).

## El problema en una frase

Hospitales de media/baja complejidad con salas de espera saturadas, procesos en papel, pacientes que no saben su posición en la fila y **cero visibilidad de los signos vitales** hasta que entran al consultorio (punto ciego clínico: descompensaciones o caídas en la sala).

## Actores

| Actor | Interfaz | Red |
| --- | --- | --- |
| Paciente / acompañante | Portal cautivo y PWA/app; wearable con OLED | VLAN 20 (Guest) |
| Enfermería / triaje / recepción | Backoffice (`apps/backoffice`) | VLAN 30 (Staff) |
| Médico | Backoffice: llamar turno | VLAN 30 |
| Hall de espera | TV llamador (`apps/tv-display`); kiosk/tótem de check-in | VLAN 40 (cableada) |
| Wearable ESP32-C3 | MQTT → Mosquitto :1883 | VLAN 10 (IoMT, sin internet) |

## Glosario (código en inglés ↔ dominio en español)

| Código | Dominio |
| --- | --- |
| `Patient` | Paciente (datos mínimos; DNI solo si hace falta, es dato personal) |
| `Ticket` / `ticketCode` | Turno / código visible (`A-024`) |
| `Queue` | Fila de espera |
| `ConsultingRoom` | Consultorio |
| `Wearable` | Pulsera IoMT |
| `TelemetryReading` | Lectura biométrica (hr, spo2, temp, accPeakG, fall) |
| `Alert` | Alerta clínica (FALL, HYPOXIA, TACHYCARDIA…) |
| `TriageLevel` | Nivel: `STABLE` (Estable), `ATTENTION` (Atención), `CRITICAL` (Crítico) |
| `CheckIn` | Registro de llegada (al conectarse al Wi-Fi o en el kiosk) |

## Reglas clínicas (prototipo académico, sin certificar)

Están implementadas en `@vitalia/contracts` (`CLINICAL_THRESHOLDS`, `assessVitals`). **Nunca las dupliques**:

- FC normal 60–100 BPM; crítica < 40 o > 130.
- SpO₂ normal ≥ 95 %; crítica < 90 % (hipoxia).
- Temperatura: fiebre > 37,5 °C; crítica > 39,5 °C; hipotermia < 35 °C. El firmware ya compensa la temperatura de piel de la muñeca.
- Caída: impacto > 2,8 g seguido de inmovilidad, detectada **en el wearable** (`fall: true`), prioridad ALTA.

## Requerimientos que condicionan el diseño

- **RNF-O1 / Cuadro 11.1:** alerta crítica en < 2 s (objetivo de diseño < 500 ms) desde el wearable hasta la UI.
- **RNF-O2:** 24 h de operación **sin internet**. Nada depende de la nube en el camino crítico.
- **RNF-O3:** todo dato médico por aire va cifrado con AES-256 (usamos AES-256-GCM).
- **RNF-O4:** UIs responsivas (móvil, tablet, escritorio).
- REST de turnos < 50 ms. Llamado de turno propagado a TV, app y OLED en < 100 ms.
- **RF-O6:** persistencia local en PostgreSQL. Réplica asíncrona a la nube cuando vuelve la WAN (Fase 5).
- Fuera de alcance: certificación ANMAT, HL7/FHIR real (se usan mocks), publicación en stores.

## Flujos principales

1. **Check-in:** el paciente se conecta al Wi-Fi → portal cautivo → registro → turno asignado → recibe un wearable.
2. **Telemetría:** wearable → MQTT `hospital/<sala>/wearable/<id>/data` (QoS 1, cifrado) → API descifra, valida, clasifica (`assessVitals`) → persiste → emite `telemetry:reading` y, si es crítico, `alert:emergency`.
3. **Llamado:** el médico llama desde el Backoffice → API → `ticket:called` a TV, app del paciente y comando MQTT al OLED del wearable.

## Checklist al diseñar una feature

- [ ] ¿Qué RF/RNF cubre? Citalo en el PR o la doc.
- [ ] ¿Funciona sin internet?
- [ ] ¿Usa los contratos y reglas de `@vitalia/contracts`?
- [ ] ¿Expone datos personales? Minimizalos y usá solo datos simulados.
- [ ] ¿Afecta la latencia del camino crítico (MQTT → WS)?
