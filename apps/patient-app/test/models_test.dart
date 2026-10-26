import 'package:flutter_test/flutter_test.dart';
import 'package:vitalia_paciente/core/config.dart';
import 'package:vitalia_paciente/core/format.dart';
import 'package:vitalia_paciente/core/models.dart';

import 'fixtures.dart';

void main() {
  test('PatientOverview se lee del contrato, con signos y sin DNI', () {
    final o = PatientOverview.fromJson(overviewJson(vitals: vitalsJson));
    expect(o.displayName, 'Bruno D.');
    expect(o.ticket.code, 'B-004');
    expect(o.ticket.statusLabel, 'En espera');
    expect(o.ticket.position, 2);
    expect(o.ticket.estimatedWaitMinutes, 24);
    expect(o.vitals!.temp, 37.8);
    expect(o.vitals!.reasons, hasLength(2));
    expect(PatientOverview.fromJson(overviewJson()).vitals, isNull);
  });

  test('la visita guardada conserva consultorio, profesional y signos', () {
    final o = PatientOverview.fromJson(
      overviewJson(
        status: 'CALLED',
        position: null,
        room: 'Box 1',
        professional: 'Dra. Laura Fernández',
        vitals: vitalsJson,
      ),
    );
    final v = Visit.fromJson(Visit.fromOverview(o, DateTime.utc(2026, 10, 25, 15)).toJson());
    expect(v.consultingRoomName, 'Box 1');
    expect(v.professionalName, 'Dra. Laura Fernández');
    expect(v.lastVitals!.hr, 104);
    expect(v.statusLabel, 'Llamado');
  });

  test('agenda: próximos primero (el más cercano arriba) y pasados al final', () {
    final now = DateTime(2026, 10, 25, 12);
    Appointment a(String id, DateTime at) => Appointment(id: id, title: id, at: at);
    final sorted = sortAgenda([
      a('pasado-viejo', DateTime(2026, 9, 1)),
      a('lejos', DateTime(2026, 12, 1)),
      a('pasado', DateTime(2026, 10, 20)),
      a('cerca', DateTime(2026, 10, 26, 9)),
    ], now);
    expect(sorted.map((x) => x.id), ['cerca', 'lejos', 'pasado', 'pasado-viejo']);
    expect(Appointment.fromJson(sorted.first.toJson()).at, sorted.first.at.toUtc());
  });

  test('ficha de salud vacía y con datos', () {
    expect(const HealthCard().isEmpty, isTrue);
    final card = HealthCard.fromJson({'bloodType': 'A+', 'allergies': 'Penicilina'});
    expect(card.isEmpty, isFalse);
    expect(HealthCard.fromJson(card.toJson()).allergies, 'Penicilina');
  });

  test('dirección del servidor', () {
    expect(normalizeApiUrl('10.0.20.1:8080/'), 'http://10.0.20.1:8080');
    expect(normalizeApiUrl(' http://10.0.2.2:3000 '), 'http://10.0.2.2:3000');
    expect(normalizeApiUrl('https://gw.hospital.local/vitalia/'), 'https://gw.hospital.local/vitalia');
    expect(normalizeApiUrl(''), isNull);
    expect(normalizeApiUrl('ftp://x'), isNull);
  });

  test('fechas en español', () {
    final now = DateTime(2026, 10, 25, 12);
    expect(longDate(DateTime(2026, 10, 25)), 'domingo 25 de octubre');
    expect(shortDate(DateTime(2026, 10, 25)), '25 oct 2026');
    expect(dayLabel(DateTime(2026, 10, 26, 9), now), 'Mañana');
    expect(dayLabel(DateTime(2026, 10, 28), now), 'Miércoles 28 de octubre');
    expect(ago(now.subtract(const Duration(minutes: 3)), now), 'hace 3 min');
    expect(waitLabel(3), 'menos de 5 min');
    expect(waitLabel(24), '~24 min');
  });
}
