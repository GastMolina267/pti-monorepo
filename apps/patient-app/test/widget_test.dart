import 'package:flutter_test/flutter_test.dart';
import 'package:vitalia_paciente/app.dart';
import 'package:vitalia_paciente/core/app_controller.dart';
import 'package:vitalia_paciente/core/storage.dart';
import 'package:vitalia_paciente/features/turno/pair_screen.dart';

import 'fixtures.dart';

void main() {
  testWidgets('sin turno muestra cómo sacarlo o vincularlo, y las cuatro pestañas', (tester) async {
    final app = AppController(store: MemoryStore(), httpClient: fakeApi({}));
    await app.load();
    await tester.pumpWidget(VitaliaApp(app: app));
    await tester.pumpAndSettle();

    expect(find.text('Tu turno, siempre a mano'), findsOneWidget);
    expect(find.text('Sacar turno'), findsOneWidget);
    expect(find.text('Ya tengo turno: vincular con código'), findsOneWidget);
    for (final tab in ['Turno', 'Mi salud', 'Agenda', 'Ficha']) {
      expect(find.text(tab), findsOneWidget);
    }

    await tester.tap(find.text('Ficha'));
    await tester.pumpAndSettle();
    expect(find.text('Completar mi ficha'), findsOneWidget);
  });

  testWidgets('con turno vinculado muestra el número, a dónde y con quién', (tester) async {
    final app = AppController(
      store: MemoryStore(),
      httpClient: fakeApi({
        'POST /api/patient/pair': (_) => jsonResponse(sessionJson()),
        'GET /api/patient/me': (_) => jsonResponse(
          overviewJson(
            status: 'CALLED',
            position: null,
            room: 'Box de Guardia 1',
            professional: 'Dra. Laura Fernández',
          ),
        ),
      }),
    );
    await app.load();
    await app.pair('K7M2QX');
    await tester.pumpWidget(VitaliaApp(app: app));
    await tester.pumpAndSettle();

    expect(find.text('B-004'), findsOneWidget);
    expect(find.text('Box de Guardia 1'), findsWidgets);
    expect(find.text('Con Dra. Laura Fernández'), findsOneWidget);
    expect(find.text('Prioridad media'), findsOneWidget);
    app.dispose();
  });

  test('el campo del código solo acepta el alfabeto y 6 caracteres', () {
    final f = PairingCodeFormatter();
    final out = f.formatEditUpdate(TextEditingValue.empty, const TextEditingValue(text: 'k7m-0o2qxzz'));
    expect(out.text, 'K7M2QX');
  });
}
