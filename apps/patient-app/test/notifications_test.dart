import 'package:flutter_test/flutter_test.dart';
import 'package:vitalia_paciente/core/app_controller.dart';
import 'package:vitalia_paciente/core/models.dart';
import 'package:vitalia_paciente/core/notifications.dart';
import 'package:vitalia_paciente/core/pairing.dart';
import 'package:vitalia_paciente/core/storage.dart';

import 'fixtures.dart';

class FakeNotifier implements Notifier {
  final called = <PatientTicket>[];
  final synced = <List<Appointment>>[];
  int permissionRequests = 0;

  @override
  Future<void> init() async {}

  @override
  Future<bool> requestPermission() async {
    permissionRequests++;
    return true;
  }

  @override
  Future<void> showCalled(PatientTicket ticket) async => called.add(ticket);

  @override
  Future<void> syncReminders(List<Appointment> agenda, DateTime now) async => synced.add(agenda);
}

void main() {
  final now = DateTime.utc(2026, 10, 25, 14, 10);

  test('recordatorio 2 h antes; si falta menos, 15 min antes; si ya pasó, ninguno', () {
    Appointment at(DateTime d) => Appointment(id: '1', title: 'Cardiología', at: d);
    expect(reminderTime(at(now.add(const Duration(hours: 5))), now), now.add(const Duration(hours: 3)));
    expect(reminderTime(at(now.add(const Duration(hours: 1))), now), now.add(const Duration(minutes: 45)));
    expect(reminderTime(at(now.add(const Duration(minutes: 10))), now), isNull);
    final a = Appointment(id: 'x', title: 'Control', at: now.add(const Duration(days: 1)), place: 'Hospital');
    expect(reminderId(a), reminderId(a));
    expect(reminderId(a), greaterThanOrEqualTo(1000));
    final (title, body) = reminderText(a, now);
    expect(title, startsWith('Turno a las '));
    expect(body, contains('Hospital'));
  });

  test('el QR o el código escrito dan el mismo código', () {
    expect(parsePairingCode('vitalia://vincular?codigo=K7M2QX'), 'K7M2QX');
    expect(parsePairingCode(' k7m-2qx '), 'K7M2QX');
    expect(parsePairingCode('https://otra.cosa/qr'), isNull);
    expect(parsePairingCode('K7M2Q0'), isNull);
  });

  test('con la app minimizada el llamado llega como notificación; la agenda se reprograma', () async {
    final notifier = FakeNotifier();
    var body = overviewJson();
    final app = AppController(
      store: MemoryStore(),
      notifier: notifier,
      clock: () => now,
      httpClient: fakeApi({
        'POST /api/patient/pair': (_) => jsonResponse(sessionJson()),
        'GET /api/patient/me': (_) => jsonResponse(body),
      }),
    );
    await app.load();
    await app.pair('K7M2QX');
    expect(notifier.permissionRequests, 1);

    app.setForeground(false);
    body = overviewJson(status: 'CALLED', position: null, room: 'Box 1', calledAt: '2026-10-25T14:09:50.000Z');
    await app.refresh();
    expect(notifier.called.single.consultingRoomName, 'Box 1');
    expect(calledText(notifier.called.single).$2, 'Andá a Box 1.');

    await app.saveAppointment(Appointment(id: '1', title: 'Control', at: now.add(const Duration(days: 2))));
    expect(notifier.synced.last, hasLength(1));
    await app.deleteAppointment('1');
    expect(notifier.synced.last, isEmpty);
    app.dispose();
  });
}
