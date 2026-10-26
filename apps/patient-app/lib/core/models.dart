/// Modelos de la app. Los que vienen de la API espejan `@vitalia/contracts`
/// (`libs/shared/contracts/src/lib/patient`); los locales (visitas, agenda, ficha) nunca salen
/// del teléfono.
library;

import '../generated/vitalia_contracts.g.dart';

typedef Json = Map<String, dynamic>;

String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;
int? _int(Object? v) => v is num ? v.round() : null;
double? _double(Object? v) => v is num ? v.toDouble() : null;
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;
DateTime _dateOr(Object? v, DateTime fallback) => _date(v) ?? fallback;

/// Estados que ya no cambian: la visita terminó.
const finalTicketStatuses = {'DONE', 'NO_SHOW', 'CANCELLED'};

/// `ServiceArea` (`GET /api/services`).
class ServiceArea {
  const ServiceArea({required this.code, required this.name, required this.prefix});

  final String code;
  final String name;
  final String prefix;

  factory ServiceArea.fromJson(Json j) =>
      ServiceArea(code: j['code'] as String, name: j['name'] as String, prefix: (j['prefix'] as String?) ?? '');
}

/// `PatientSession`: token del turno, válido 24 h.
class PatientSession {
  const PatientSession({required this.token, required this.ticketId, required this.expiresAt});

  final String token;
  final String ticketId;
  final DateTime expiresAt;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);

  factory PatientSession.fromJson(Json j) => PatientSession(
    token: j['token'] as String,
    ticketId: j['ticketId'] as String,
    expiresAt: DateTime.parse(j['expiresAt'] as String),
  );

  Json toJson() => {'token': token, 'ticketId': ticketId, 'expiresAt': expiresAt.toUtc().toIso8601String()};
}

/// `PatientTicket`: el turno visto por su paciente.
class PatientTicket {
  const PatientTicket({
    required this.id,
    required this.code,
    required this.status,
    required this.serviceName,
    required this.serviceCode,
    required this.triageLevel,
    required this.checkedInAt,
    this.consultingRoomName,
    this.professionalName,
    this.position,
    this.estimatedWaitMinutes,
    this.reason,
    this.calledAt,
    this.startedAt,
    this.finishedAt,
  });

  final String id;
  final String code;
  final String status;
  final String serviceName;
  final String serviceCode;
  final String triageLevel;
  final DateTime checkedInAt;
  final String? consultingRoomName;
  final String? professionalName;
  final int? position;
  final int? estimatedWaitMinutes;
  final String? reason;
  final DateTime? calledAt;
  final DateTime? startedAt;
  final DateTime? finishedAt;

  bool get isFinal => finalTicketStatuses.contains(status);
  bool get isCalled => status == 'CALLED';
  String get statusLabel => ticketStatusLabels[status] ?? status;

  factory PatientTicket.fromJson(Json j) => PatientTicket(
    id: j['id'] as String,
    code: j['code'] as String,
    status: j['status'] as String,
    serviceName: j['serviceName'] as String,
    serviceCode: (j['serviceCode'] as String?) ?? '',
    triageLevel: (j['triageLevel'] as String?) ?? 'STABLE',
    checkedInAt: DateTime.parse(j['checkedInAt'] as String),
    consultingRoomName: _str(j['consultingRoomName']),
    professionalName: _str(j['professionalName']),
    position: _int(j['position']),
    estimatedWaitMinutes: _int(j['estimatedWaitMinutes']),
    reason: _str(j['reason']),
    calledAt: _date(j['calledAt']),
    startedAt: _date(j['startedAt']),
    finishedAt: _date(j['finishedAt']),
  );
}

/// `PatientVitals`: última lectura de la pulsera con su evaluación.
class PatientVitals {
  const PatientVitals({
    required this.wearableCode,
    required this.measuredAt,
    required this.level,
    this.hr,
    this.spo2,
    this.temp,
    this.fall = false,
    this.reasons = const [],
  });

  final String wearableCode;
  final DateTime measuredAt;
  final int? hr;
  final int? spo2;
  final double? temp;
  final bool fall;
  final String level;
  final List<String> reasons;

  factory PatientVitals.fromJson(Json j) => PatientVitals(
    wearableCode: j['wearableCode'] as String,
    measuredAt: DateTime.parse(j['measuredAt'] as String),
    hr: _int(j['hr']),
    spo2: _int(j['spo2']),
    temp: _double(j['temp']),
    fall: j['fall'] == true,
    level: (j['level'] as String?) ?? 'STABLE',
    reasons: [for (final r in (j['reasons'] as List<dynamic>? ?? const [])) r.toString()],
  );

  Json toJson() => {
    'wearableCode': wearableCode,
    'measuredAt': measuredAt.toUtc().toIso8601String(),
    'hr': hr,
    'spo2': spo2,
    'temp': temp,
    'fall': fall,
    'level': level,
    'reasons': reasons,
  };
}

/// `GET /api/patient/me`.
class PatientOverview {
  const PatientOverview({
    required this.firstName,
    required this.displayName,
    required this.ticket,
    required this.serverTime,
    this.vitals,
  });

  final String firstName;
  final String displayName;
  final PatientTicket ticket;
  final PatientVitals? vitals;
  final DateTime serverTime;

  factory PatientOverview.fromJson(Json j) {
    final patient = j['patient'] as Json;
    final vitals = j['vitals'];
    return PatientOverview(
      firstName: patient['firstName'] as String,
      displayName: patient['displayName'] as String,
      ticket: PatientTicket.fromJson(j['ticket'] as Json),
      vitals: vitals is Json ? PatientVitals.fromJson(vitals) : null,
      serverTime: _dateOr(j['serverTime'], DateTime.now()),
    );
  }
}

/// Respuesta del check-in (`CheckInResponse`).
class CheckInResult {
  const CheckInResult({required this.ticketId, required this.code, required this.serviceName, this.session});

  final String ticketId;
  final String code;
  final String serviceName;

  /// Solo viene si el turno se creó en este pedido (un DNI repetido no la recibe).
  final PatientSession? session;

  factory CheckInResult.fromJson(Json j) {
    final s = j['patientSession'];
    return CheckInResult(
      ticketId: j['id'] as String,
      code: j['code'] as String,
      serviceName: j['serviceName'] as String,
      session: s is Json ? PatientSession.fromJson(s) : null,
    );
  }
}

/// Un punto de la curva (`VitalsPoint`).
class VitalsPoint {
  const VitalsPoint({required this.at, this.hr, this.spo2, this.temp, this.fall = false, this.level = 'STABLE'});

  final DateTime at;
  final double? hr;
  final double? spo2;
  final double? temp;
  final bool fall;
  final String level;

  factory VitalsPoint.fromJson(Json j) => VitalsPoint(
    at: DateTime.parse(j['at'] as String),
    hr: _double(j['hr']),
    spo2: _double(j['spo2']),
    temp: _double(j['temp']),
    fall: j['fall'] == true,
    level: (j['level'] as String?) ?? 'STABLE',
  );
}

/// `GET /api/patient/me/readings` (`VitalsHistory`).
class VitalsHistory {
  const VitalsHistory({required this.from, required this.to, required this.bucketSeconds, required this.points});

  final DateTime from;
  final DateTime to;
  final int bucketSeconds;
  final List<VitalsPoint> points;

  factory VitalsHistory.fromJson(Json j) => VitalsHistory(
    from: DateTime.parse(j['from'] as String),
    to: DateTime.parse(j['to'] as String),
    bucketSeconds: _int(j['bucketSeconds']) ?? 3,
    points: [for (final p in (j['points'] as List<dynamic>? ?? const [])) VitalsPoint.fromJson(p as Json)],
  );
}

/// Una visita guardada en el teléfono («Mis visitas»): la última foto del turno.
class Visit {
  const Visit({
    required this.ticketId,
    required this.code,
    required this.serviceName,
    required this.status,
    required this.checkedInAt,
    required this.triageLevel,
    required this.updatedAt,
    this.consultingRoomName,
    this.professionalName,
    this.reason,
    this.calledAt,
    this.finishedAt,
    this.lastVitals,
  });

  final String ticketId;
  final String code;
  final String serviceName;
  final String status;
  final DateTime checkedInAt;
  final String triageLevel;
  final DateTime updatedAt;
  final String? consultingRoomName;
  final String? professionalName;
  final String? reason;
  final DateTime? calledAt;
  final DateTime? finishedAt;
  final PatientVitals? lastVitals;

  String get statusLabel => ticketStatusLabels[status] ?? status;

  factory Visit.fromOverview(PatientOverview o, DateTime now) {
    final t = o.ticket;
    return Visit(
      ticketId: t.id,
      code: t.code,
      serviceName: t.serviceName,
      status: t.status,
      checkedInAt: t.checkedInAt,
      triageLevel: t.triageLevel,
      updatedAt: now,
      consultingRoomName: t.consultingRoomName,
      professionalName: t.professionalName,
      reason: t.reason,
      calledAt: t.calledAt,
      finishedAt: t.finishedAt,
      lastVitals: o.vitals,
    );
  }

  factory Visit.fromJson(Json j) {
    final v = j['lastVitals'];
    return Visit(
      ticketId: j['ticketId'] as String,
      code: j['code'] as String,
      serviceName: j['serviceName'] as String,
      status: j['status'] as String,
      checkedInAt: DateTime.parse(j['checkedInAt'] as String),
      triageLevel: (j['triageLevel'] as String?) ?? 'STABLE',
      updatedAt: _dateOr(j['updatedAt'], DateTime.parse(j['checkedInAt'] as String)),
      consultingRoomName: _str(j['consultingRoomName']),
      professionalName: _str(j['professionalName']),
      reason: _str(j['reason']),
      calledAt: _date(j['calledAt']),
      finishedAt: _date(j['finishedAt']),
      lastVitals: v is Json ? PatientVitals.fromJson(v) : null,
    );
  }

  Json toJson() => {
    'ticketId': ticketId,
    'code': code,
    'serviceName': serviceName,
    'status': status,
    'checkedInAt': checkedInAt.toUtc().toIso8601String(),
    'triageLevel': triageLevel,
    'updatedAt': updatedAt.toUtc().toIso8601String(),
    'consultingRoomName': consultingRoomName,
    'professionalName': professionalName,
    'reason': reason,
    'calledAt': calledAt?.toUtc().toIso8601String(),
    'finishedAt': finishedAt?.toUtc().toIso8601String(),
    'lastVitals': lastVitals?.toJson(),
  };
}

/// Turno médico que el paciente anota en su agenda (en cualquier lugar, no solo Vitalia).
class Appointment {
  const Appointment({
    required this.id,
    required this.title,
    required this.at,
    this.place = '',
    this.professional = '',
    this.notes = '',
  });

  final String id;

  /// Especialidad o motivo: «Control de cardiología».
  final String title;
  final DateTime at;
  final String place;
  final String professional;
  final String notes;

  bool isPast(DateTime now) => at.isBefore(now.subtract(const Duration(hours: 1)));

  Appointment copyWith({String? title, DateTime? at, String? place, String? professional, String? notes}) =>
      Appointment(
        id: id,
        title: title ?? this.title,
        at: at ?? this.at,
        place: place ?? this.place,
        professional: professional ?? this.professional,
        notes: notes ?? this.notes,
      );

  factory Appointment.fromJson(Json j) => Appointment(
    id: j['id'] as String,
    title: j['title'] as String,
    at: DateTime.parse(j['at'] as String),
    place: (j['place'] as String?) ?? '',
    professional: (j['professional'] as String?) ?? '',
    notes: (j['notes'] as String?) ?? '',
  );

  Json toJson() => {
    'id': id,
    'title': title,
    'at': at.toUtc().toIso8601String(),
    'place': place,
    'professional': professional,
    'notes': notes,
  };
}

/// Próximos primero (el más cercano arriba); los pasados al final, el más reciente arriba.
List<Appointment> sortAgenda(Iterable<Appointment> items, DateTime now) {
  final upcoming = items.where((a) => !a.isPast(now)).toList()..sort((a, b) => a.at.compareTo(b.at));
  final past = items.where((a) => a.isPast(now)).toList()..sort((a, b) => b.at.compareTo(a.at));
  return [...upcoming, ...past];
}

const bloodTypes = ['0+', '0−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'];

/// Ficha de salud: la escribe el paciente y queda cifrada en el teléfono. Vitalia no la envía
/// a ningún lado; sirve para mostrarla al personal o tenerla a mano.
class HealthCard {
  const HealthCard({
    this.fullName = '',
    this.birthDate = '',
    this.bloodType = '',
    this.allergies = '',
    this.conditions = '',
    this.medications = '',
    this.insurance = '',
    this.insuranceNumber = '',
    this.emergencyName = '',
    this.emergencyPhone = '',
    this.notes = '',
  });

  final String fullName;
  final String birthDate;
  final String bloodType;
  final String allergies;
  final String conditions;
  final String medications;
  final String insurance;
  final String insuranceNumber;
  final String emergencyName;
  final String emergencyPhone;
  final String notes;

  bool get isEmpty => toJson().values.every((v) => (v as String).trim().isEmpty);

  factory HealthCard.fromJson(Json j) {
    String s(String k) => (j[k] as String?) ?? '';
    return HealthCard(
      fullName: s('fullName'),
      birthDate: s('birthDate'),
      bloodType: s('bloodType'),
      allergies: s('allergies'),
      conditions: s('conditions'),
      medications: s('medications'),
      insurance: s('insurance'),
      insuranceNumber: s('insuranceNumber'),
      emergencyName: s('emergencyName'),
      emergencyPhone: s('emergencyPhone'),
      notes: s('notes'),
    );
  }

  Json toJson() => {
    'fullName': fullName,
    'birthDate': birthDate,
    'bloodType': bloodType,
    'allergies': allergies,
    'conditions': conditions,
    'medications': medications,
    'insurance': insurance,
    'insuranceNumber': insuranceNumber,
    'emergencyName': emergencyName,
    'emergencyPhone': emergencyPhone,
    'notes': notes,
  };
}
