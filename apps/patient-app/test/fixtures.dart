import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Respuestas de la API con la forma de `@vitalia/contracts` (datos simulados).
Map<String, dynamic> overviewJson({
  String status = 'WAITING',
  int? position = 2,
  String? room,
  String? professional,
  String? calledAt,
  Map<String, dynamic>? vitals,
}) => {
  'patient': {'firstName': 'Bruno', 'displayName': 'Bruno D.'},
  'ticket': {
    'id': 't-1',
    'code': 'B-004',
    'status': status,
    'serviceName': 'Guardia',
    'serviceCode': 'GUARDIA',
    'triageLevel': 'ATTENTION',
    'consultingRoomName': room,
    'professionalName': professional,
    'position': position,
    'estimatedWaitMinutes': position == null ? null : position * 12,
    'checkedInAt': '2026-10-25T14:00:00.000Z',
    'calledAt': calledAt,
    'reason': 'Fiebre',
    'startedAt': null,
    'finishedAt': null,
  },
  'vitals': vitals,
  'serverTime': '2026-10-25T14:10:00.000Z',
};

final vitalsJson = {
  'wearableCode': 'wb-03-5e0003',
  'measuredAt': '2026-10-25T14:09:57.000Z',
  'hr': 104,
  'spo2': 97,
  'temp': 37.8,
  'fall': false,
  'level': 'ATTENTION',
  'reasons': ['Taquicardia leve (104 lpm)', 'Fiebre (37.8 °C)'],
};

Map<String, dynamic> sessionJson({String expiresAt = '2099-01-01T00:00:00.000Z'}) => {
  'token': 'tok-123',
  'ticketId': 't-1',
  'expiresAt': expiresAt,
};

http.Response jsonResponse(Object body, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(body)),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

/// API falsa: `routes['GET /api/patient/me']` → respuesta.
MockClient fakeApi(Map<String, http.Response Function(http.Request)> routes, {List<http.Request>? log}) =>
    MockClient((req) async {
      log?.add(req);
      final handler = routes['${req.method} ${req.url.path}'];
      return handler == null ? jsonResponse({'message': 'No existe'}, 404) : handler(req);
    });
