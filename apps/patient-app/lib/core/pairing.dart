import '../generated/vitalia_contracts.g.dart';

/// Código de vinculación de un QR (`vitalia://vincular?codigo=K7M2QX`) o de un texto escrito.
/// Espejo de `parsePairingCode` de `@vitalia/contracts`. `null` si no es un código válido.
String? parsePairingCode(String raw) {
  final text = raw.trim();
  final prefix = VtPatient.pairingQrPrefix;
  final value = text.toLowerCase().startsWith(prefix) ? text.substring(prefix.length) : text;
  final code = value.toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
  final valid =
      code.length == VtPatient.pairingCodeLength && code.split('').every(VtPatient.pairingCodeAlphabet.contains);
  return valid ? code : null;
}
