import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vitalia_paciente/core/api_client.dart';

import 'fixtures.dart';

void main() {
  test('check-in con source PATIENT_APP y sesión en la respuesta', () async {
    final log = <http.Request>[];
    final api = VitaliaApi(
      baseUrl: 'http://gw:3000',
      client: fakeApi({
        'POST /api/check-in': (_) => jsonResponse({
          'id': 't-1',
          'code': 'B-004',
          'status': 'WAITING',
          'serviceName': 'Guardia',
          'position': 2,
          'estimatedWaitMinutes': 24,
          'checkedInAt': '2026-10-25T14:00:00.000Z',
          'patientSession': sessionJson(),
        }, 201),
      }, log: log),
    );
    final result = await api.checkIn(
      firstName: ' Bruno ',
      lastName: 'Díaz',
      serviceCode: 'GUARDIA',
      documentNumber: '',
    );
    expect(result.code, 'B-004');
    expect(result.session!.token, 'tok-123');
    final body = jsonDecode(log.single.body) as Map<String, dynamic>;
    expect(body, {'firstName': 'Bruno', 'lastName': 'Díaz', 'serviceCode': 'GUARDIA', 'source': 'PATIENT_APP'});
  });

  test('manda el token del paciente y lee su turno', () async {
    final log = <http.Request>[];
    final api = VitaliaApi(
      baseUrl: 'http://gw:3000',
      client: fakeApi({'GET /api/patient/me': (_) => jsonResponse(overviewJson())}, log: log),
    );
    final me = await api.me('tok-123');
    expect(me.ticket.serviceName, 'Guardia');
    expect(log.single.headers['authorization'], 'Bearer tok-123');
  });

  test('los errores de Nest llegan en español', () async {
    final api = VitaliaApi(
      baseUrl: 'http://gw:3000',
      client: fakeApi({
        'POST /api/patient/pair': (_) =>
            jsonResponse({'message': 'El código no es válido o venció: pedile uno nuevo al personal'}, 401),
        'GET /api/services': (_) => jsonResponse({
          'message': ['servicio inválido', 'otro'],
        }, 400),
      }),
    );
    await expectLater(
      api.pair('AAAAAA'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isUnauthorized, '401', isTrue)
            .having((e) => e.message, 'msg', contains('pedile')),
      ),
    );
    await expectLater(
      api.services(),
      throwsA(isA<ApiException>().having((e) => e.message, 'msg', 'servicio inválido\notro')),
    );
    expect(errorMessageFrom(429, ''), contains('Esperá un minuto'));
    expect(errorMessageFrom(502, '<html>'), contains('problema'));
  });
}
