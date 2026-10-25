import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../widgets/common.dart';

/// Vincular un turno sacado en el portal cautivo o en recepción: el personal genera un código
/// de un solo uso en el Backoffice (Turnos → ⋮ → «Vincular app del paciente»).
class PairScreen extends StatefulWidget {
  const PairScreen({super.key, required this.app});

  final AppController app;

  static Route<void> route(AppController app) => MaterialPageRoute(builder: (_) => PairScreen(app: app));

  @override
  State<PairScreen> createState() => _PairScreenState();
}

/// Solo deja escribir las letras y números del alfabeto del código, en mayúsculas.
class PairingCodeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final clean = newValue.text
        .toUpperCase()
        .split('')
        .where((c) => VtPatient.pairingCodeAlphabet.contains(c))
        .take(VtPatient.pairingCodeLength)
        .join();
    return TextEditingValue(text: clean, selection: TextSelection.collapsed(offset: clean.length));
  }
}

class _PairScreenState extends State<PairScreen> {
  final _code = TextEditingController();
  bool _saving = false;
  String? _error;

  bool get _complete => _code.text.length == VtPatient.pairingCodeLength;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_complete || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.app.pair(_code.text);
      if (!mounted) return;
      Navigator.of(context).pop();
      final code = widget.app.ticket?.code;
      showMessage(context, code == null ? 'Turno vinculado' : 'Turno $code vinculado');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Vincular mi turno')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const EmptyState(
              icon: Icons.link_rounded,
              title: 'Escribí el código del personal',
              message:
                  'Si sacaste turno en el portal del Wi-Fi o en recepción, pedile al personal un código '
                  'para la app. Vale 10 minutos y una sola vez.',
            ),
            TextField(
              controller: _code,
              autofocus: true,
              textAlign: TextAlign.center,
              textCapitalization: TextCapitalization.characters,
              keyboardType: TextInputType.visiblePassword,
              autocorrect: false,
              enableSuggestions: false,
              inputFormatters: [PairingCodeFormatter()],
              onChanged: (_) => setState(() => _error = null),
              onSubmitted: (_) => _submit(),
              style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: 10),
              decoration: InputDecoration(
                hintText: 'K7M2QX',
                hintStyle: TextStyle(color: scheme.onSurfaceVariant.withValues(alpha: 0.35), letterSpacing: 10),
                errorText: _error,
                errorMaxLines: 3,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _complete && !_saving ? _submit : null,
              child: _saving
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : const Text('Vincular'),
            ),
          ],
        ),
      ),
    );
  }
}
