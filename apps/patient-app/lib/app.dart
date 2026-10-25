import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/app_controller.dart';
import 'features/home_shell.dart';
import 'theme/vitalia_theme.dart';
import 'widgets/common.dart';

/// Raíz de la app: tema Vitalia (claro/oscuro según el sistema) y textos en español.
class VitaliaApp extends StatelessWidget {
  const VitaliaApp({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vitalia',
      debugShowCheckedModeBanner: false,
      theme: VitaliaTheme.light(),
      darkTheme: VitaliaTheme.dark(),
      locale: const Locale('es', 'AR'),
      supportedLocales: const [Locale('es', 'AR'), Locale('es')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      home: ListenableBuilder(
        listenable: app,
        builder: (context, _) => app.ready ? HomeShell(app: app) : const _Splash(),
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: VitaliaLogo(size: 56, subtitle: 'Tu turno, siempre a mano')));
}
