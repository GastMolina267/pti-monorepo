import 'package:flutter_test/flutter_test.dart';
import 'package:vitalia_paciente/core/app_controller.dart';
import 'package:vitalia_paciente/core/models.dart';
import 'package:vitalia_paciente/core/storage.dart';

import 'fixtures.dart';

void main() {
  final now = DateTime.utc(2026, 10, 25, 14, 10);

  AppController controller(MemoryStore store, Map<String, dynamic> Function() me, {void Function()? onCalled}) =>
      AppController(
        store: store,
        clock: () => now,
        onCalled: onCalled,
        httpClient: fakeApi({
          'POST /api/patient/pair': (_) => jsonResponse(sessionJson()),
          'GET /api/patient/me': (_) {
            final body = me();
            return body.containsKey('message') ? jsonResponse(body, 401) : jsonResponse(body);
          },
        }),
      );

  test('vincular guarda la sesión cifrada y la visita; al llamarlo avisa una sola vez', () async {
    final store = MemoryStore();
    var calls = 0;
    var body = overviewJson();
    final app = controller(store, () => body, onCalled: () => calls++);
    await app.load();

    await app.pair('k7m 2qx');
    expect(app.session!.token, 'tok-123');
    expect(store.data[StoreKeys.session], contains('tok-123'));
    expect(app.ticket!.code, 'B-004');
    expect(app.visits.single.status, 'WAITING');

    body = overviewJson(status: 'CALLED', position: null, room: 'Box de Guardia 1', calledAt: '2026-10-25T14:09:30.000Z');
    await app.refresh();
    expect(app.calledNotice, isTrue);
    expect(calls, 1);
    expect(app.visits.single.consultingRoomName, 'Box de Guardia 1');

    app.dismissCalled();
    await app.refresh();
    expect(app.calledNotice, isFalse);
    expect(calls, 1);
    app.dispose();
  });

  test('si la sesión vence (401) se desvincula y la visita queda guardada', () async {
    final store = MemoryStore();
    var body = overviewJson();
    final app = controller(store, () => body);
    await app.load();
    await app.pair('K7M2QX');

    body = {'message': 'Tu sesión venció o no es válida: vinculá la app otra vez'};
    await app.refresh();
    expect(app.session, isNull);
    expect(store.data.containsKey(StoreKeys.session), isFalse);
    expect(app.visits, hasLength(1));
    expect(app.takeFlash(), contains('venció'));
    app.dispose();
  });

  test('al abrir descarta una sesión vencida y carga agenda y ficha', () async {
    final store = MemoryStore();
    final seed = AppController(store: store, clock: () => now);
    await seed.saveAppointment(Appointment(id: '1', title: 'Cardiología', at: DateTime.utc(2026, 11, 2, 12)));
    await seed.saveHealthCard(const HealthCard(bloodType: '0+'));
    await store.writeJson(StoreKeys.session, sessionJson(expiresAt: '2026-10-24T00:00:00.000Z'));

    final app = AppController(store: store, clock: () => now);
    await app.load();
    expect(app.session, isNull);
    expect(app.agenda.single.title, 'Cardiología');
    expect(app.upcoming, hasLength(1));
    expect(app.healthCard.bloodType, '0+');

    await app.clearAll();
    expect(app.agenda, isEmpty);
    expect(store.data, isEmpty);
  });
}
