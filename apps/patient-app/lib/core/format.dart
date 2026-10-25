/// Fechas y horas en español rioplatense, sin depender de `intl` (formatos fijos y cortos).
library;

const _weekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

String _two(int n) => n.toString().padLeft(2, '0');

/// `14:05` en la hora local del teléfono.
String hhmm(DateTime d) {
  final l = d.toLocal();
  return '${_two(l.hour)}:${_two(l.minute)}';
}

/// `domingo 25 de octubre`.
String longDate(DateTime d) {
  final l = d.toLocal();
  return '${_weekdays[l.weekday - 1]} ${l.day} de ${_months[l.month - 1]}';
}

/// `25 oct 2026`.
String shortDate(DateTime d) {
  final l = d.toLocal();
  return '${l.day} ${_months[l.month - 1].substring(0, 3)} ${l.year}';
}

/// `Hoy`, `Mañana`, `Ayer` o la fecha larga con mayúscula inicial.
String dayLabel(DateTime d, DateTime now) {
  final a = DateTime(d.toLocal().year, d.toLocal().month, d.toLocal().day);
  final b = DateTime(now.toLocal().year, now.toLocal().month, now.toLocal().day);
  final diff = a.difference(b).inDays;
  if (diff == 0) return 'Hoy';
  if (diff == 1) return 'Mañana';
  if (diff == -1) return 'Ayer';
  final text = longDate(d);
  return text[0].toUpperCase() + text.substring(1);
}

/// `recién`, `hace 3 min`, `hace 2 h`, `hace 4 días`.
String ago(DateTime d, DateTime now) {
  final s = now.difference(d).inSeconds;
  if (s < 45) return 'recién';
  if (s < 3600) return 'hace ${(s / 60).round()} min';
  if (s < 86400) return 'hace ${(s / 3600).floor()} h';
  final days = (s / 86400).floor();
  return days == 1 ? 'hace 1 día' : 'hace $days días';
}

/// `~25 min` o `menos de 5 min`.
String waitLabel(int minutes) => minutes < 5 ? 'menos de 5 min' : '~$minutes min';
