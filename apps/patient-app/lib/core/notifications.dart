import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import 'format.dart';
import 'models.dart';

/// Notificaciones locales (sin servidor ni internet): el aviso del llamado cuando la app está
/// minimizada y los recordatorios de la agenda. Interfaz chica para poder usar un doble en tests.
abstract class Notifier {
  Future<void> init();

  /// Pide el permiso de Android 13+ (no hace nada si ya está concedido o no hace falta).
  Future<bool> requestPermission();

  Future<void> showCalled(PatientTicket ticket);

  /// Reprograma los recordatorios según la agenda actual (cancela los viejos).
  Future<void> syncReminders(List<Appointment> agenda, DateTime now);
}

/// Cuánto antes del turno llega el recordatorio (y el mínimo, si ya falta menos).
const reminderLead = Duration(hours: 2);
const reminderShortLead = Duration(minutes: 15);

/// Momento del recordatorio de un turno de la agenda, o `null` si ya no tiene sentido.
DateTime? reminderTime(Appointment a, DateTime now) {
  final early = a.at.subtract(reminderLead);
  if (early.isAfter(now)) return early;
  final late = a.at.subtract(reminderShortLead);
  return late.isAfter(now) ? late : null;
}

/// Id estable de la notificación de un turno de la agenda (positivo, 31 bits).
int reminderId(Appointment a) => 1000 + (a.id.hashCode & 0x3fffffff);

const calledNotificationId = 1;

/// Texto del recordatorio: «Turno a las 14:30 · Control de cardiología».
(String, String) reminderText(Appointment a, DateTime now) => (
  'Turno a las ${hhmm(a.at)} · ${a.title}',
  [
    dayLabel(a.at, now),
    if (a.place.isNotEmpty) a.place,
    if (a.professional.isNotEmpty) a.professional,
  ].join(' · '),
);

/// Texto del aviso del llamado.
(String, String) calledText(PatientTicket t) => (
  '¡Te llamaron! · ${t.code}',
  'Andá a ${t.consultingRoomName ?? 'consultorio'}${t.professionalName == null ? '' : ' con ${t.professionalName}'}.',
);

class LocalNotifier implements Notifier {
  final _plugin = FlutterLocalNotificationsPlugin();

  static const _called = AndroidNotificationDetails(
    'vitalia_llamado',
    'Llamado de tu turno',
    channelDescription: 'Te avisa cuando te llaman a consultorio',
    importance: Importance.max,
    priority: Priority.high,
    category: AndroidNotificationCategory.call,
    icon: 'ic_stat_vitalia',
  );

  static const _reminder = AndroidNotificationDetails(
    'vitalia_agenda',
    'Recordatorios de la agenda',
    channelDescription: 'Recordatorio antes de cada turno que anotás',
    importance: Importance.high,
    priority: Priority.high,
    category: AndroidNotificationCategory.reminder,
    icon: 'ic_stat_vitalia',
  );

  @override
  Future<void> init() async {
    await _plugin.initialize(const InitializationSettings(android: AndroidInitializationSettings('ic_stat_vitalia')));
  }

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  @override
  Future<bool> requestPermission() async => await _android?.requestNotificationsPermission() ?? false;

  @override
  Future<void> showCalled(PatientTicket ticket) {
    final (title, body) = calledText(ticket);
    return _plugin.show(calledNotificationId, title, body, const NotificationDetails(android: _called));
  }

  @override
  Future<void> syncReminders(List<Appointment> agenda, DateTime now) async {
    for (final p in await _plugin.pendingNotificationRequests()) {
      if (p.id != calledNotificationId) await _plugin.cancel(p.id);
    }
    for (final a in agenda) {
      final at = reminderTime(a, now);
      if (at == null) continue;
      final (title, body) = reminderText(a, now);
      await _plugin.zonedSchedule(
        reminderId(a),
        title,
        body,
        // Un instante absoluto: no hace falta la base de husos horarios.
        tz.TZDateTime.from(at.toUtc(), tz.UTC),
        const NotificationDetails(android: _reminder),
        // Inexacto: no requiere el permiso de alarmas exactas (minutos de diferencia).
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    }
  }
}
