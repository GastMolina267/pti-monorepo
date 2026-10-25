import 'package:flutter/material.dart';

import '../core/app_controller.dart';
import '../widgets/common.dart';
import 'agenda/agenda_screen.dart';
import 'ajustes/settings_screen.dart';
import 'ficha/ficha_screen.dart';
import 'salud/salud_screen.dart';
import 'turno/turno_screen.dart';

/// Estructura principal: cuatro pestañas (Turno · Mi salud · Agenda · Ficha).
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.app});

  final AppController app;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onResume: () => widget.app.setForeground(true),
      onPause: () => widget.app.setForeground(false),
    );
    widget.app.addListener(_showFlash);
  }

  @override
  void dispose() {
    widget.app.removeListener(_showFlash);
    _lifecycle.dispose();
    super.dispose();
  }

  /// Mensajes de una sola vez (por ejemplo, sesión vencida).
  void _showFlash() {
    final message = widget.app.takeFlash();
    if (message != null && mounted) showMessage(context, message);
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    return ListenableBuilder(
      listenable: app,
      builder: (context, _) {
        final pages = [TurnoScreen(app: app), SaludScreen(app: app), AgendaScreen(app: app), FichaScreen(app: app)];
        return Scaffold(
          appBar: AppBar(
            title: const VitaliaLogo(size: 30),
            actions: [
              IconButton(
                tooltip: 'Ajustes',
                icon: const Icon(Icons.settings_outlined),
                onPressed: () => Navigator.of(context).push(SettingsScreen.route(app)),
              ),
            ],
          ),
          body: SafeArea(
            top: false,
            child: IndexedStack(index: _tab, children: pages),
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: [
              NavigationDestination(
                icon: Badge(isLabelVisible: app.calledNotice, child: const Icon(Icons.confirmation_number_outlined)),
                selectedIcon: const Icon(Icons.confirmation_number),
                label: 'Turno',
              ),
              const NavigationDestination(
                icon: Icon(Icons.monitor_heart_outlined),
                selectedIcon: Icon(Icons.monitor_heart),
                label: 'Mi salud',
              ),
              const NavigationDestination(
                icon: Icon(Icons.event_note_outlined),
                selectedIcon: Icon(Icons.event_note),
                label: 'Agenda',
              ),
              const NavigationDestination(
                icon: Icon(Icons.medical_information_outlined),
                selectedIcon: Icon(Icons.medical_information),
                label: 'Ficha',
              ),
            ],
          ),
        );
      },
    );
  }
}
