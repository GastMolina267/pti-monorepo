import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Almacenamiento clave/valor de la app. Todo lo del paciente (sesión, visitas, agenda, ficha
/// de salud) es dato sensible (Ley 25.326), así que en el teléfono va cifrado.
abstract class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
  Future<void> clear();
}

/// Android Keystore + EncryptedSharedPreferences (`flutter_secure_storage`).
class SecureStore implements KeyValueStore {
  SecureStore() : _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);

  @override
  Future<void> clear() => _storage.deleteAll();
}

/// Para tests (y para arrancar aunque el Keystore falle).
class MemoryStore implements KeyValueStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);

  @override
  Future<void> clear() async => data.clear();
}

/// Claves guardadas.
abstract final class StoreKeys {
  static const apiUrl = 'vitalia.apiUrl';
  static const session = 'vitalia.session';
  static const visits = 'vitalia.visits';
  static const agenda = 'vitalia.agenda';
  static const healthCard = 'vitalia.healthCard';
}

extension JsonStore on KeyValueStore {
  Future<Object?> readJson(String key) async {
    final raw = await read(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw);
    } on FormatException {
      await delete(key); // dato corrupto: se descarta en vez de romper el arranque
      return null;
    }
  }

  Future<void> writeJson(String key, Object? value) => value == null ? delete(key) : write(key, jsonEncode(value));
}
