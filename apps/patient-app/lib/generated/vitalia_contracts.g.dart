// GENERADO con `pnpm app:codegen` desde @vitalia/contracts y @vitalia/design-tokens.
// NO EDITAR A MANO: cambiá la fuente en libs/shared y volvé a generar.
// ignore_for_file: constant_identifier_names

import 'dart:ui' show Color;

/// Colores de la marca Vitalia (`libs/shared/design-tokens/src/lib/brand.ts`).
abstract final class VtColors {
  static const primary = Color(0xFF0D9488);
  static const primaryLight = Color(0xFF14B8A6);
  static const primaryDeep = Color(0xFF0F766E);
  static const secondary = Color(0xFF0284C7);
  static const secondaryLight = Color(0xFF38BDF8);
  static const secondaryDeep = Color(0xFF0369A1);
  static const success = Color(0xFF10B981);
  static const successDeep = Color(0xFF059669);
  static const live = Color(0xFF34D399);
  static const warning = Color(0xFFF59E0B);
  static const warningDeep = Color(0xFFD97706);
  static const danger = Color(0xFFF43F5E);
  static const dangerDeep = Color(0xFFBE123C);
  static const indigo = Color(0xFF6366F1);
  static const cyan = Color(0xFF06B6D4);
}

/// Neutros del modo claro.
abstract final class VtLight {
  static const bg = Color(0xFFF8FAFC);
  static const bg2 = Color(0xFFF1F5F9);
  static const paper = Color(0xFFFFFFFF);
  static const ink = Color(0xFF0F172A);
  static const muted = Color(0xFF475569);
  static const muted2 = Color(0xFF64748B);
}

/// Neutros del modo oscuro.
abstract final class VtDark {
  static const bg = Color(0xFF06111D);
  static const bg2 = Color(0xFF0B1A2C);
  static const paper = Color(0xFF0B1A2C);
  static const ink = Color(0xFFF1F5FB);
  static const muted = Color(0xFF94A3B8);
  static const muted2 = Color(0xFF64748B);
}

/// Umbrales clínicos (`CLINICAL_THRESHOLDS`): bandas normales de la curva.
abstract final class VtThresholds {
  static const heartRateNormalMin = 60;
  static const heartRateNormalMax = 100;
  static const heartRateCriticalMin = 40;
  static const heartRateCriticalMax = 130;
  static const spo2NormalMin = 95;
  static const spo2CriticalBelow = 90;
  static const temperatureFeverAbove = 37.5;
  static const temperatureCriticalAbove = 39.5;
  static const temperatureHypothermiaBelow = 35;
}

/// API y tiempo real.
abstract final class VtApi {
  static const prefix = 'api';
  static const readyEvent = 'realtime:ready';
  static const errorEvent = 'realtime:error';
  static const ticketCalledEvent = 'ticket:called';
  static const queueUpdatedEvent = 'queue:updated';
  static const checkInSource = 'PATIENT_APP';
  static const vitalsDefaultMinutes = 120;
  static const vitalsMaxMinutes = 1440;
}

/// Sesión de turno y código de vinculación (ADR 0019).
abstract final class VtPatient {
  static const sessionHours = 24;
  static const pairingCodeLength = 6;
  static const pairingCodeTtlMinutes = 10;
  static const pairingCodeAlphabet = '2346789ABCDEFGHJKMNPQRTUVWXYZ';
}

const ticketStatuses = <String>['WAITING', 'CALLED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED'];
const openTicketStatuses = <String>['WAITING', 'CALLED', 'IN_PROGRESS'];
const ticketStatusLabels = <String, String>{
  'WAITING': 'En espera',
  'CALLED': 'Llamado',
  'IN_PROGRESS': 'En atención',
  'DONE': 'Finalizado',
  'NO_SHOW': 'Ausente',
  'CANCELLED': 'Cancelado',
};

const triageLevels = <String>['STABLE', 'ATTENTION', 'CRITICAL'];
const triageLevelLabels = <String, String>{
  'STABLE': 'Estable',
  'ATTENTION': 'Atención',
  'CRITICAL': 'Crítico',
};

/// Cómo se le muestra el triaje al paciente: prioridad, no diagnóstico.
const patientPriorityLabels = <String, String>{
  'STABLE': 'Prioridad habitual',
  'ATTENTION': 'Prioridad media',
  'CRITICAL': 'Prioridad alta',
};

const triageColors = <String, Color>{
  'STABLE': Color(0xFF10B981),
  'ATTENTION': Color(0xFFF59E0B),
  'CRITICAL': Color(0xFFF43F5E),
};
