import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:http/http.dart' as http;

import '../generated/vitalia_contracts.g.dart';
import 'config.dart';
import 'models.dart';

/// Error de la API con un mensaje listo para mostrar (en español, como los manda Nest).
class ApiException implements Exception {
  const ApiException(this.message, {this.status});

  final String message;

  /// Código HTTP, o `null` si no hubo respuesta (sin red, servidor apagado, timeout).
  final int? status;

  bool get isUnauthorized => status == 401;
  bool get isOffline => status == null;

  @override
  String toString() => message;
}

/// Mensaje de error de una respuesta de Nest: `{ message: string | string[] }`.
String errorMessageFrom(int status, String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) {
      final m = decoded['message'];
      if (m is String && m.isNotEmpty) return m;
      if (m is List && m.isNotEmpty) return m.map((e) => e.toString()).join('\n');
    }
  } on FormatException {
    // no era JSON
  }
  if (status == 429) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  if (status >= 500) return 'El servidor del hospital tuvo un problema. Probá de nuevo en un rato.';
  return 'No se pudo completar el pedido (HTTP $status).';
}

/// Cliente de la API del gateway para la app del paciente (ADR 0019).
class VitaliaApi {
  VitaliaApi({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  /// `http://10.0.2.2:3000` (sin `/api`).
  final String baseUrl;
  final http.Client _client;

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl/${VtApi.prefix}$path').replace(queryParameters: query);

  Future<Object?> _send(Future<http.Response> Function() request) async {
    final http.Response res;
    try {
      res = await request().timeout(AppConfig.requestTimeout);
    } on TimeoutException {
      throw const ApiException('El servidor del hospital no respondió. ¿Estás conectado al Wi-Fi del hospital?');
    } on SocketException {
      throw const ApiException('No hay conexión con el hospital. Conectate al Wi-Fi del hospital y probá de nuevo.');
    } on http.ClientException {
      throw const ApiException('No hay conexión con el hospital. Conectate al Wi-Fi del hospital y probá de nuevo.');
    }
    final body = utf8.decode(res.bodyBytes);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(errorMessageFrom(res.statusCode, body), status: res.statusCode);
    }
    return body.isEmpty ? null : jsonDecode(body);
  }

  Map<String, String> _headers({String? token}) => {
    'content-type': 'application/json',
    'accept': 'application/json',
    if (token != null) 'authorization': 'Bearer $token',
  };

  /// `GET /api/health`: para probar la dirección del servidor en Ajustes.
  Future<String> health() async {
    final json = await _send(() => _client.get(_uri('/health'), headers: _headers())) as Json;
    return json['status'] as String;
  }

  Future<List<ServiceArea>> services() async {
    final json = await _send(() => _client.get(_uri('/services'), headers: _headers())) as List<dynamic>;
    return [for (final s in json) ServiceArea.fromJson(s as Json)];
  }

  /// Check-in desde la app (`source: PATIENT_APP`).
  Future<CheckInResult> checkIn({
    required String firstName,
    required String lastName,
    required String serviceCode,
    String? documentNumber,
    String? reason,
  }) async {
    final body = jsonEncode({
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      'serviceCode': serviceCode,
      'source': VtApi.checkInSource,
      if (documentNumber != null && documentNumber.trim().isNotEmpty) 'documentNumber': documentNumber.trim(),
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
    final json = await _send(() => _client.post(_uri('/check-in'), headers: _headers(), body: body)) as Json;
    return CheckInResult.fromJson(json);
  }

  /// Vincula la app a un turno con el código que generó el personal.
  Future<PatientSession> pair(String code) async {
    final body = jsonEncode({'code': code});
    final json = await _send(() => _client.post(_uri('/patient/pair'), headers: _headers(), body: body)) as Json;
    return PatientSession.fromJson(json);
  }

  Future<PatientOverview> me(String token) async {
    final json = await _send(() => _client.get(_uri('/patient/me'), headers: _headers(token: token))) as Json;
    return PatientOverview.fromJson(json);
  }

  Future<VitalsHistory> readings(String token, {int minutes = VtApi.vitalsDefaultMinutes}) async {
    final uri = _uri('/patient/me/readings', {'minutes': '$minutes'});
    final json = await _send(() => _client.get(uri, headers: _headers(token: token))) as Json;
    return VitalsHistory.fromJson(json);
  }

  void close() => _client.close();
}
