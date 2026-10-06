# 00 · Visión del proyecto

> Síntesis de la tesis _"Ecosistema Digital Hospitalario: Integración de Conectividad Gestionada, Sistema de Turnos Omnicanal y Monitoreo Biométrico IoT"_ (PTI, Ingeniería Informática, Universidad Blas Pascal, 2026). El PDF completo está en el Proyecto PTI.

**Marca:** Vitalia · **Equipo:** Facundo Gomez Geneiro, Gastón Molina, Tomás Molina · **Tutor:** Oscar Luis Gencarelli

## Problema

Los centros de salud de media complejidad tienen salas de espera saturadas y procesos en papel ("papel y birome"):

1. **Saturación y tiempos muertos.** Procesos manuales lentos e incertidumbre del paciente.
2. **Brecha de comunicación hospital-paciente.** El paciente no conoce su posición en la fila y queda en "espera pasiva" dentro del edificio.
3. **Monitoreo discontinuo (punto ciego clínico).** Los signos vitales son desconocidos hasta que el paciente entra al consultorio, con riesgo ante descompensaciones o caídas en la sala.

## Objetivo general

Diseñar e implementar un ecosistema que optimice la atención hospitalaria combinando **conectividad gestionada**, **autogestión de turnos** y **monitoreo biométrico IoT en tiempo real**, con conectividad local resiliente.

## Objetivos específicos

| Objetivo                                                 | Dónde se materializa                          |
| -------------------------------------------------------- | --------------------------------------------- |
| Edge Gateway local autónomo (Wi-Fi + broker MQTT)        | `infra/`, `docker-compose.yml`, router RUT956 |
| Interfaz multiplataforma de turnos para el paciente      | Portal cautivo (repo aparte) y app/PWA        |
| Consola web unificada (Backoffice) para el equipo médico | `apps/backoffice`, `apps/tv-display`          |
| Wearable ESP32-C3 (MAX30102, MLX90614, MPU6050, OLED)    | `apps/wearable-firmware-poc`                  |
| Persistencia local + cifrado AES-256                     | `apps/api` (PostgreSQL, módulo de telemetría) |

## Alcance

**Incluye:** prototipo del wearable (protoboard → formato portable, alimentado por USB) · Edge Gateway Docker (Mosquitto + NestJS + PostgreSQL) · app/PWA del paciente · Backoffice médico · sincronización asíncrona a la nube · cifrado AES-256 de la telemetría.

**Excluye:** certificación clínica (ANMAT) · integración real con HCE/HL7/FHIR (se usan mocks) · carcasa industrial · tendido de red corporativa (se usa un router de laboratorio) · publicación en stores · batería LiPo (queda como evolución futura).

## Arquitectura en una línea

**Edge** (wearables) → **Fog** (Edge Gateway en el hospital: Mosquitto + API NestJS + PostgreSQL + Nginx) → **Cloud** (réplica asíncrona). El hospital sigue operando al 100 % sin internet. Detalle en [01-arquitectura.md](01-arquitectura.md).

## Criterios de éxito (Cuadro 11.1)

| Métrica                                      | Objetivo                    |
| -------------------------------------------- | --------------------------- |
| Latencia de alerta crítica (caída / hipoxia) | < 500 ms (requisito: < 2 s) |
| Respuesta REST de turnos                     | < 50 ms                     |
| Pérdida de paquetes MQTT en la intranet      | 0 % (QoS ≥ 1)               |
| Operación sin WAN                            | 100 % durante ≥ 24 h        |
| Aislamiento de clientes en la red guest      | 100 %                       |

## Diferencias con la tesis

Se registran acá para actualizar la memoria final:

- **Nombre de marca:** "Vitalia" (la tesis usa "Ecosistema Digital Hospitalario").
- **App del paciente:** la tesis la plantea en Flutter. Hoy el paciente usa el **portal cautivo en React** (repo `pti-captive-portal`). La app Flutter queda como opcional (ver roadmap).
- **Cifrado:** se especifica **AES-256-GCM** (modo autenticado) dentro del contenido del mensaje MQTT. La tesis habla de "cifrado en capa de transporte" ([ADR 0006](adr/0006-cifrado-aes-256-gcm.md)).
