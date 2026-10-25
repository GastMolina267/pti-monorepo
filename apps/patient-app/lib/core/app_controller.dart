import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'config.dart';
import 'models.dart';
import 'realtime.dart';
import 'storage.dart';

/// Cuántas visitas se guardan en el teléfono.
const maxVisits = 50;

/// Si al abrir la app el turno ya estaba llamado hace menos que esto, igual se avisa.
const calledNoticeWindow = Duration(minutes: 3);

/// Estado de la app: sesión del turno, su vista en vivo y los datos locales (visitas, agenda,
/// ficha). Un solo `ChangeNotifier`: la app es chica y así no suma dependencias.
class AppController extends ChangeNotifier {
  AppController({
    required KeyValueStore store,
    http.Client? httpClient,
    RealtimeFactory? realtimeFactory,
    DateTime Function()? clock,
    this.onCalled,
  }) : _store = store,
       _httpClient = httpClient,
       _realtimeFactory = realtimeFactory,
       _clock = clock ?? DateTime.now;

  final KeyValueStore _store;
  final http.Client? _httpClient;
  final RealtimeFactory? _realtimeFactory;
  final DateTime Function() _clock;

  /// Vibración o sonido cuando llaman el turno (lo engancha la UI).
  final void Function()? onCalled;

  String _apiUrl = AppConfig.defaultApiUrl;
  VitaliaApi? _api;
  PatientRealtime? _realtime;
  Timer? _poll;
  bool _foreground = true;
  bool _disposed = false;
  DateTime? _notifiedCalledAt;

  bool ready = false;
  PatientSession? session;
  PatientOverview? overview;
  DateTime? lastUpdated;
  String? error;
  bool refreshing = false;

  /// `true` mientras el WebSocket del turno está conectado.
  bool live = false;

  /// Aviso «¡Te llamaron!» pendiente de cerrar.
  bool calledNotice = false;

  /// Mensaje para mostrar una vez (snackbar), por ejemplo cuando vence la sesión.
  String? flash;

  List<Visit> visits = const [];
  List<Appointment> agenda = const [];
  HealthCard healthCard = const HealthCard();

  String get apiUrl => _apiUrl;
  VitaliaApi get api => _api ??= VitaliaApi(baseUrl: _apiUrl, client: _httpClient);
  DateTime now() => _clock();

  bool get hasSession => session != null;
  PatientTicket? get ticket => overview?.ticket;

  List<Appointment> get upcoming => agenda.where((a) => !a.isPast(now())).toList();

  // ---------------------------------------------------------------- arranque

  Future<void> load() async {
    try {
      final url = await _store.read(StoreKeys.apiUrl);
      final normalized = url == null ? null : normalizeApiUrl(url);
      if (normalized != null) _apiUrl = normalized;

      final s = await _store.readJson(StoreKeys.session);
      if (s is Map<String, dynamic>) {
        try {
          final parsed = PatientSession.fromJson(s);
          if (!parsed.isExpired(now())) session = parsed;
        } on Object {
          // sesión vieja o corrupta: se ignora
        }
        if (session == null) await _store.delete(StoreKeys.session);
      }

      visits = _list(await _store.readJson(StoreKeys.visits), Visit.fromJson);
      agenda = sortAgenda(_list(await _store.readJson(StoreKeys.agenda), Appointment.fromJson), now());
      final card = await _store.readJson(StoreKeys.healthCard);
      if (card is Map<String, dynamic>) healthCard = HealthCard.fromJson(card);
    } on Object catch (e) {
      // Si el almacenamiento cifrado falla, la app igual arranca (sin datos guardados).
      flash = 'No se pudieron leer los datos guardados en el teléfono ($e).';
    } finally {
      ready = true;
      _notify();
    }
    if (session != null) {
      await refresh();
      _startLive();
    }
  }

  static List<T> _list<T>(Object? raw, T Function(Map<String, dynamic>) parse) {
    if (raw is! List) return const [];
    final out = <T>[];
    for (final item in raw) {
      if (item is! Map<String, dynamic>) continue;
      try {
        out.add(parse(item));
      } on Object {
        // se descarta el ítem dañado
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- servidor

  Future<void> setApiUrl(String raw) async {
    final url = normalizeApiUrl(raw);
    if (url == null) throw const ApiException('Escribí una dirección válida, por ejemplo http://10.0.20.1:8080');
    _apiUrl = url;
    _api?.close();
    _api = null;
    await _store.write(StoreKeys.apiUrl, url);
    if (session != null) _startLive();
    _notify();
  }

  /// Prueba la dirección sin guardarla. Devuelve el estado del gateway (`ok`, `degraded`).
  Future<String> testConnection(String raw) async {
    final url = normalizeApiUrl(raw);
    if (url == null) throw const ApiException('Escribí una dirección válida, por ejemplo http://10.0.20.1:8080');
    final probe = VitaliaApi(baseUrl: url, client: _httpClient);
    return probe.health();
  }

  // ---------------------------------------------------------------- turno

  Future<List<ServiceArea>> services() => api.services();

  /// Saca un turno desde la app. Si el DNI ya tenía un turno abierto, la API devuelve ese turno
  /// pero sin sesión (el DNI no es secreto): hay que vincularlo con un código del personal.
  Future<CheckInResult> checkIn({
    required String firstName,
    required String lastName,
    required String serviceCode,
    String? documentNumber,
    String? reason,
  }) async {
    final result = await api.checkIn(
      firstName: firstName,
      lastName: lastName,
      serviceCode: serviceCode,
      documentNumber: documentNumber,
      reason: reason,
    );
    final s = result.session;
    if (s != null) await _setSession(s);
    return result;
  }

  Future<void> pair(String code) async {
    final s = await api.pair(code.toUpperCase().replaceAll(RegExp(r'[\s-]'), ''));
    await _setSession(s);
  }

  Future<void> _setSession(PatientSession s) async {
    session = s;
    overview = null;
    error = null;
    _notifiedCalledAt = null;
    await _store.writeJson(StoreKeys.session, s.toJson());
    _notify();
    await refresh();
    _startLive();
  }

  Future<void> refresh() async {
    final s = session;
    if (s == null || refreshing) return;
    if (s.isExpired(now())) {
      await _endSession('Tu turno de hoy ya no está vinculado (pasaron 24 h). Lo encontrás en Mis visitas.');
      return;
    }
    refreshing = true;
    _notify();
    try {
      final next = await api.me(s.token);
      _apply(next);
      error = null;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _endSession('Tu sesión venció. Si seguís en el hospital, pedile al personal un código nuevo.');
      } else {
        error = e.message;
      }
    } finally {
      refreshing = false;
      _notify();
    }
  }

  void _apply(PatientOverview next) {
    final previous = overview;
    overview = next;
    lastUpdated = now();

    final t = next.ticket;
    final calledAt = t.calledAt;
    if (t.isCalled && calledAt != null && calledAt != _notifiedCalledAt) {
      final fresh = previous != null || now().difference(calledAt) < calledNoticeWindow;
      _notifiedCalledAt = calledAt;
      if (fresh) {
        calledNotice = true;
        onCalled?.call();
      }
    }
    if (t.isFinal) _stopPolling();

    unawaited(_saveVisit(Visit.fromOverview(next, now())));
  }

  void dismissCalled() {
    calledNotice = false;
    _notify();
  }

  Future<VitalsHistory> readings(int minutes) {
    final s = session;
    if (s == null) throw const ApiException('Vinculá un turno para ver tus signos vitales');
    return api.readings(s.token, minutes: minutes);
  }

  /// Desvincula el turno de este teléfono. La visita queda guardada en «Mis visitas».
  Future<void> unlink() => _endSession(null);

  Future<void> _endSession(String? message) async {
    _stopLive();
    session = null;
    overview = null;
    calledNotice = false;
    flash = message;
    await _store.delete(StoreKeys.session);
    _notify();
  }

  String? takeFlash() {
    final f = flash;
    flash = null;
    return f;
  }

  // ---------------------------------------------------------------- en vivo

  /// La UI avisa si la app está en primer plano: en segundo plano no se consulta.
  void setForeground(bool value) {
    if (_foreground == value) return;
    _foreground = value;
    if (value && session != null) {
      unawaited(refresh());
      _startLive();
    } else {
      _stopLive();
    }
  }

  void _startLive() {
    _stopLive();
    final s = session;
    if (s == null || !_foreground) return;
    if (!(overview?.ticket.isFinal ?? false)) {
      _poll = Timer.periodic(AppConfig.pollInterval, (_) => unawaited(refresh()));
    }
    final factory = _realtimeFactory;
    if (factory == null) return;
    _realtime = factory(_apiUrl)
      ..connect(
        s.ticketId,
        onCalled: () => unawaited(refresh()),
        onStatus: (connected) {
          live = connected;
          _notify();
        },
      );
  }

  void _stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  void _stopLive() {
    _stopPolling();
    _realtime?.disconnect();
    _realtime = null;
    live = false;
  }

  // ---------------------------------------------------------------- datos locales

  Future<void> _saveVisit(Visit v) async {
    final list = [v, ...visits.where((x) => x.ticketId != v.ticketId)]
      ..sort((a, b) => b.checkedInAt.compareTo(a.checkedInAt));
    visits = list.take(maxVisits).toList();
    await _store.writeJson(StoreKeys.visits, [for (final x in visits) x.toJson()]);
  }

  Future<void> deleteVisit(String ticketId) async {
    visits = visits.where((v) => v.ticketId != ticketId).toList();
    await _store.writeJson(StoreKeys.visits, [for (final x in visits) x.toJson()]);
    _notify();
  }

  Future<void> saveAppointment(Appointment a) async {
    agenda = sortAgenda([a, ...agenda.where((x) => x.id != a.id)], now());
    await _store.writeJson(StoreKeys.agenda, [for (final x in agenda) x.toJson()]);
    _notify();
  }

  Future<void> deleteAppointment(String id) async {
    agenda = agenda.where((x) => x.id != id).toList();
    await _store.writeJson(StoreKeys.agenda, [for (final x in agenda) x.toJson()]);
    _notify();
  }

  Future<void> saveHealthCard(HealthCard card) async {
    healthCard = card;
    await _store.writeJson(StoreKeys.healthCard, card.toJson());
    _notify();
  }

  /// Borra todo lo guardado en el teléfono (menos la dirección del servidor).
  Future<void> clearAll() async {
    _stopLive();
    session = null;
    overview = null;
    calledNotice = false;
    visits = const [];
    agenda = const [];
    healthCard = const HealthCard();
    for (final key in [StoreKeys.session, StoreKeys.visits, StoreKeys.agenda, StoreKeys.healthCard]) {
      await _store.delete(key);
    }
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _stopLive();
    _api?.close();
    super.dispose();
  }
}
