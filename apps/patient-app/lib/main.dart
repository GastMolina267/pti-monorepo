import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'core/app_controller.dart';
import 'core/realtime.dart';
import 'core/storage.dart';

/// Vitalia · app del paciente (Android). Ver `apps/patient-app/AGENTS.md` y ADR 0019.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final app = AppController(store: SecureStore(), realtimeFactory: SocketIoRealtime.new, onCalled: _buzz);
  runApp(VitaliaApp(app: app));
  await app.load();
}

/// Tres vibraciones fuertes: «¡te llamaron!».
void _buzz() {
  unawaited(() async {
    for (var i = 0; i < 3; i++) {
      await HapticFeedback.heavyImpact();
      await Future<void>.delayed(const Duration(milliseconds: 350));
    }
  }());
}
