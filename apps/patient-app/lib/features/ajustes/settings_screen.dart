import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/config.dart';
import '../../core/format.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../widgets/common.dart';

/// Ajustes: dirección del servidor del hospital, turno vinculado y borrado de datos.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.app});

  final AppController app;

  static Route<void> route(AppController app) => MaterialPageRoute(builder: (_) => SettingsScreen(app: app));

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _url = TextEditingController(text: widget.app.apiUrl);
  String? _status;
  bool _testing = false;

  @override
  void dispose() {
    _url.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _status = null;
    });
    try {
      final status = await widget.app.testConnection(_url.text);
      if (!mounted) return;
      setState(
        () => _status = status == 'ok' ? '✓ Conectado al hospital' : '✓ Conectado (servidor con avisos: $status)',
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _status = e.message);
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    try {
      await widget.app.setApiUrl(_url.text);
      if (mounted) showMessage(context, 'Servidor guardado');
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message);
    }
  }

  Future<bool> _confirm(String title, String message, String action) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(action)),
          ],
        ),
      ) ??
      false;

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    final scheme = Theme.of(context).colorScheme;
    final session = app.session;
    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: ListenableBuilder(
        listenable: app,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          children: [
            const SectionLabel('Servidor del hospital'),
            Text(
              'La app habla con el gateway Vitalia del hospital, en su red Wi-Fi. Si el personal te '
              'indica otra dirección, cambiala acá.',
              style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _url,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Dirección', hintText: 'http://10.0.20.1:8080'),
            ),
            if (_status != null) ...[
              const SizedBox(height: 8),
              Text(
                _status!,
                style: TextStyle(fontWeight: FontWeight.w600, color: scheme.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _testing ? null : _test,
                    child: _testing
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Probar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(onPressed: _save, child: const Text('Guardar')),
                ),
              ],
            ),
            const SectionLabel('Turno vinculado'),
            if (session == null)
              Text('No hay un turno vinculado en este teléfono.', style: TextStyle(color: scheme.onSurfaceVariant))
            else
              VtCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      app.ticket == null ? 'Turno vinculado' : 'Turno ${app.ticket!.code} · ${app.ticket!.serviceName}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'El acceso vence ${dayLabel(session.expiresAt, app.now()).toLowerCase()} a las ${hhmm(session.expiresAt)}.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () async {
                        if (await _confirm(
                          '¿Desvincular el turno?',
                          'Vas a dejar de verlo en vivo en este teléfono. La visita queda en «Mis visitas».',
                          'Desvincular',
                        )) {
                          await app.unlink();
                        }
                      },
                      child: const Text('Desvincular de este teléfono'),
                    ),
                  ],
                ),
              ),
            const SectionLabel('Mis datos'),
            Text(
              'Tus visitas, tu agenda y tu ficha se guardan cifradas solo en este teléfono.',
              style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () async {
                if (await _confirm(
                  '¿Borrar todos tus datos?',
                  'Se borran del teléfono el turno vinculado, las visitas, la agenda y la ficha. No se puede deshacer.',
                  'Borrar todo',
                )) {
                  await app.clearAll();
                  if (context.mounted) showMessage(context, 'Datos borrados');
                }
              },
              icon: const Icon(Icons.delete_forever_outlined),
              label: const Text('Borrar todos mis datos'),
              style: TextButton.styleFrom(foregroundColor: VtColors.danger, alignment: Alignment.centerLeft),
            ),
            const SizedBox(height: 28),
            const Center(child: VitaliaLogo(size: 30, subtitle: 'Ecosistema digital hospitalario')),
            const SizedBox(height: 8),
            Center(
              child: Text(
                'Versión ${AppConfig.version} · PTI · UBP',
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
