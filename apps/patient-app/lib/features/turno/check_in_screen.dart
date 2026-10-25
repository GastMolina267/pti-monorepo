import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/models.dart';
import '../../widgets/common.dart';
import 'pair_screen.dart';

/// Sacar turno desde la app (RF-O5, `source: PATIENT_APP`). Mismo endpoint que el portal
/// cautivo: la API devuelve además la sesión del turno para seguirlo desde acá.
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key, required this.app});

  final AppController app;

  static Route<void> route(AppController app) => MaterialPageRoute(builder: (_) => CheckInScreen(app: app));

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  final _form = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _dni = TextEditingController();
  final _reason = TextEditingController();

  late Future<List<ServiceArea>> _services;
  String? _serviceCode;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _services = widget.app.services();
    final name = widget.app.healthCard.fullName.trim().split(RegExp(r'\s+'));
    if (name.length >= 2) {
      _firstName.text = name.first;
      _lastName.text = name.sublist(1).join(' ');
    }
  }

  @override
  void dispose() {
    for (final c in [_firstName, _lastName, _dni, _reason]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await widget.app.checkIn(
        firstName: _firstName.text,
        lastName: _lastName.text,
        documentNumber: _dni.text,
        serviceCode: _serviceCode!,
        reason: _reason.text,
      );
      if (!mounted) return;
      if (result.session == null) {
        await _alreadyHasTicket(result);
      } else {
        Navigator.of(context).pop();
        showMessage(context, 'Listo: tu turno es el ${result.code}');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// El DNI ya tenía un turno abierto hoy: no se entrega la sesión sin un código del personal.
  Future<void> _alreadyHasTicket(CheckInResult result) async {
    final pair = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Ya tenés el turno ${result.code}'),
        content: Text(
          'Con ese DNI ya hay un turno abierto hoy en ${result.serviceName}. Para verlo en la app, '
          'pedile al personal un código de vinculación.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Entendido')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Tengo el código')),
        ],
      ),
    );
    if (!mounted) return;
    if (pair == true) {
      await Navigator.of(context).pushReplacement(PairScreen.route(widget.app));
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Sacar turno')),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              Text(
                'Completá tus datos. Tu turno aparece en la TV de la sala y acá, en la app.',
                style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _firstName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Nombre'),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Escribí tu nombre' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _lastName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Apellido'),
                validator: (v) => (v ?? '').trim().length < 2 ? 'Escribí tu apellido' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dni,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(9)],
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'DNI (opcional)',
                  helperText: 'Sirve para no duplicar tu turno si volvés a registrarte',
                ),
                validator: (v) {
                  final value = (v ?? '').trim();
                  return value.isEmpty || RegExp(r'^\d{7,9}$').hasMatch(value) ? null : 'El DNI tiene 7 a 9 números';
                },
              ),
              const SizedBox(height: 12),
              FutureBuilder<List<ServiceArea>>(
                future: _services,
                builder: (context, snap) {
                  if (snap.hasError) {
                    return _ServicesError(
                      message: snap.error.toString(),
                      onRetry: () => setState(() => _services = widget.app.services()),
                    );
                  }
                  final services = snap.data;
                  return DropdownButtonFormField<String>(
                    initialValue: _serviceCode,
                    decoration: InputDecoration(
                      labelText: 'Servicio',
                      suffixIcon: services == null
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                            )
                          : null,
                    ),
                    items: [
                      for (final s in services ?? const <ServiceArea>[])
                        DropdownMenuItem(value: s.code, child: Text(s.name)),
                    ],
                    onChanged: services == null ? null : (v) => setState(() => _serviceCode = v),
                    validator: (v) => v == null ? 'Elegí el servicio' : null,
                  );
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _reason,
                maxLength: 280,
                maxLines: 3,
                minLines: 2,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(labelText: 'Motivo de la consulta (opcional)'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 4),
                Text(_error!, style: TextStyle(color: scheme.error, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Sacar turno'),
              ),
              const SizedBox(height: 12),
              Text(
                'Tus datos se usan solo para atenderte en el hospital (Ley 25.326).',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServicesError extends StatelessWidget {
  const _ServicesError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scheme.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Row(
        children: [
          Icon(Icons.wifi_off_rounded, color: scheme.error),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
          TextButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}
