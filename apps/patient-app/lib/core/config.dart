/// Configuración de compilación de la app del paciente.
///
/// `VITALIA_API_URL` se pasa con `--dart-define` (ver `apps/patient-app/project.json`). Por
/// defecto apunta a la API de desarrollo vista desde el emulador de Android (`10.0.2.2` es la
/// PC donde corre el emulador). En el hospital se cambia desde Ajustes por la IP del gateway.
abstract final class AppConfig {
  static const defaultApiUrl = String.fromEnvironment('VITALIA_API_URL', defaultValue: 'http://10.0.2.2:3000');

  /// Cada cuánto se consulta el turno mientras la app está abierta (el llamado llega además
  /// por WebSocket al instante).
  static const pollInterval = Duration(seconds: 10);

  static const requestTimeout = Duration(seconds: 10);

  static const version = '1.0.0';
}

/// `http://10.0.20.1:8080/` → `http://10.0.20.1:8080`. Devuelve `null` si no es una URL http(s).
String? normalizeApiUrl(String raw) {
  var value = raw.trim();
  if (value.isEmpty) return null;
  if (!value.startsWith('http://') && !value.startsWith('https://')) value = 'http://$value';
  final uri = Uri.tryParse(value);
  if (uri == null || uri.host.isEmpty) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  final path = uri.path.replaceAll(RegExp(r'/+$'), '');
  return '${uri.scheme}://${uri.authority}$path';
}
