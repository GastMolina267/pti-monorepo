import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_controller.dart';
import '../../core/models.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../theme/vitalia_theme.dart';
import '../../widgets/common.dart';

/// Pestaña «Ficha»: datos de salud que el paciente quiere tener a mano (grupo sanguíneo,
/// alergias, medicación, contacto de emergencia). Cifrados en el teléfono y nunca enviados.
class FichaScreen extends StatelessWidget {
  const FichaScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final card = app.healthCard;
    if (card.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          EmptyState(
            icon: Icons.medical_information_outlined,
            title: 'Tu ficha de salud',
            message:
                'Guardá tu grupo sanguíneo, alergias, medicación y un contacto de emergencia. '
                'Queda cifrada solo en este teléfono y se la podés mostrar al personal.',
            actions: [
              FilledButton.icon(
                onPressed: () => Navigator.of(context).push(HealthCardEditor.route(app)),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Completar mi ficha'),
              ),
            ],
          ),
        ],
      );
    }

    String or(String v) => v.trim().isEmpty ? 'Sin datos' : v.trim();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        _Header(card: card),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => Navigator.of(context).push(EmergencyCardScreen.route(card)),
          icon: const Icon(Icons.fullscreen),
          label: const Text('Mostrar al personal'),
        ),
        const SectionLabel('Salud'),
        VtCard(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
          child: Column(
            children: [
              InfoRow(icon: Icons.warning_amber_rounded, label: 'Alergias', value: or(card.allergies)),
              InfoRow(icon: Icons.healing_outlined, label: 'Enfermedades o condiciones', value: or(card.conditions)),
              InfoRow(icon: Icons.medication_outlined, label: 'Medicación habitual', value: or(card.medications)),
              if (card.notes.trim().isNotEmpty) InfoRow(icon: Icons.notes, label: 'Notas', value: card.notes.trim()),
            ],
          ),
        ),
        const SectionLabel('Cobertura y emergencia'),
        VtCard(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
          child: Column(
            children: [
              InfoRow(
                icon: Icons.badge_outlined,
                label: 'Obra social o prepaga',
                value: or([card.insurance.trim(), card.insuranceNumber.trim()].where((s) => s.isNotEmpty).join(' · ')),
              ),
              InfoRow(
                icon: Icons.contact_phone_outlined,
                label: 'Contacto de emergencia',
                value: or('${card.emergencyName.trim()} ${card.emergencyPhone.trim()}'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push(HealthCardEditor.route(app)),
          icon: const Icon(Icons.edit_outlined),
          label: const Text('Editar mi ficha'),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Icon(Icons.lock_outline, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Cifrada en este teléfono. Vitalia no la envía al hospital ni a la nube.',
                style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.card});

  final HealthCard card;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(gradient: VitaliaTheme.brandGradient, borderRadius: BorderRadius.circular(26)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.fullName.trim().isEmpty ? 'Mi ficha' : card.fullName.trim(),
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                ),
                if (card.birthDate.trim().isNotEmpty)
                  Text(
                    'Nacimiento: ${card.birthDate.trim()}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.9)),
                  ),
              ],
            ),
          ),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(20),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  card.bloodType.isEmpty ? '–' : card.bloodType,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
                ),
                const Text(
                  'GRUPO',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Edición de la ficha.
class HealthCardEditor extends StatefulWidget {
  const HealthCardEditor({super.key, required this.app});

  final AppController app;

  static Route<void> route(AppController app) => MaterialPageRoute(builder: (_) => HealthCardEditor(app: app));

  @override
  State<HealthCardEditor> createState() => _HealthCardEditorState();
}

class _HealthCardEditorState extends State<HealthCardEditor> {
  late final Map<String, TextEditingController> _c;
  late String _bloodType;

  static const _fields = [
    'fullName',
    'birthDate',
    'allergies',
    'conditions',
    'medications',
    'insurance',
    'insuranceNumber',
    'emergencyName',
    'emergencyPhone',
    'notes',
  ];

  @override
  void initState() {
    super.initState();
    final json = widget.app.healthCard.toJson();
    _c = {for (final f in _fields) f: TextEditingController(text: json[f] as String? ?? '')};
    _bloodType = widget.app.healthCard.bloodType;
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final card = HealthCard.fromJson({for (final f in _fields) f: _c[f]!.text.trim(), 'bloodType': _bloodType});
    await widget.app.saveHealthCard(card);
    if (!mounted) return;
    Navigator.of(context).pop();
    showMessage(context, 'Ficha guardada en el teléfono');
  }

  Widget _field(String key, String label, {String? hint, int lines = 1, TextInputType? keyboard}) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextField(
      controller: _c[key],
      minLines: 1,
      maxLines: lines,
      keyboardType: keyboard,
      textCapitalization: keyboard == null ? TextCapitalization.sentences : TextCapitalization.none,
      decoration: InputDecoration(labelText: label, hintText: hint),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi ficha de salud'),
        actions: [TextButton(onPressed: _save, child: const Text('Guardar'))],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const SectionLabel('Datos personales'),
            _field('fullName', 'Nombre y apellido'),
            _field('birthDate', 'Fecha de nacimiento', hint: '14/03/1990', keyboard: TextInputType.datetime),
            DropdownButtonFormField<String>(
              initialValue: bloodTypes.contains(_bloodType) ? _bloodType : null,
              decoration: const InputDecoration(labelText: 'Grupo sanguíneo'),
              items: [
                const DropdownMenuItem(value: '', child: Text('No sé')),
                for (final b in bloodTypes) DropdownMenuItem(value: b, child: Text(b)),
              ],
              onChanged: (v) => setState(() => _bloodType = v ?? ''),
            ),
            const SectionLabel('Salud'),
            _field('allergies', 'Alergias', hint: 'Penicilina, maní…', lines: 3),
            _field('conditions', 'Enfermedades o condiciones', hint: 'Diabetes, hipertensión…', lines: 3),
            _field('medications', 'Medicación habitual', hint: 'Enalapril 10 mg a la mañana', lines: 3),
            _field('notes', 'Otras notas', lines: 3),
            const SectionLabel('Cobertura'),
            _field('insurance', 'Obra social o prepaga'),
            _field('insuranceNumber', 'Número de afiliado', keyboard: TextInputType.text),
            const SectionLabel('Contacto de emergencia'),
            _field('emergencyName', 'Nombre y vínculo', hint: 'Ana (hermana)'),
            _field('emergencyPhone', 'Teléfono', keyboard: TextInputType.phone),
            const SizedBox(height: 8),
            FilledButton(onPressed: _save, child: const Text('Guardar')),
          ],
        ),
      ),
    );
  }
}

/// Ficha en grande, para mostrarle el teléfono al personal (alto contraste, sin distracciones).
class EmergencyCardScreen extends StatelessWidget {
  const EmergencyCardScreen({super.key, required this.card});

  final HealthCard card;

  static Route<void> route(HealthCard card) =>
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => EmergencyCardScreen(card: card));

  @override
  Widget build(BuildContext context) {
    Widget block(String label, String value, {Color? color}) => value.trim().isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                    color: color ?? VtLight.muted,
                  ),
                ),
                const SizedBox(height: 4),
                Text(value.trim(), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, height: 1.3)),
              ],
            ),
          );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Theme(
        data: VitaliaTheme.light(),
        child: Scaffold(
          backgroundColor: Colors.white,
          appBar: AppBar(
            backgroundColor: Colors.white,
            title: const VitaliaLogo(size: 28, subtitle: 'Ficha del paciente'),
          ),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
              children: [
                block('Paciente', card.fullName),
                block('Nacimiento', card.birthDate),
                block('Grupo sanguíneo', card.bloodType, color: VtColors.dangerDeep),
                block('Alergias', card.allergies, color: VtColors.dangerDeep),
                block('Enfermedades o condiciones', card.conditions),
                block('Medicación habitual', card.medications),
                block(
                  'Obra social',
                  [card.insurance, card.insuranceNumber].where((s) => s.trim().isNotEmpty).join(' · '),
                ),
                block('Contacto de emergencia', '${card.emergencyName} ${card.emergencyPhone}'),
                block('Notas', card.notes),
                const SizedBox(height: 8),
                const Text(
                  'Datos cargados por el paciente en la app Vitalia.',
                  style: TextStyle(fontSize: 13, color: VtLight.muted2),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
