import 'package:flutter/material.dart';

import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../widgets/common.dart';

/// Pestaña «Agenda»: los turnos médicos que el paciente anota (en el hospital o en cualquier
/// otro lado) para organizarse. Quedan solo en el teléfono.
class AgendaScreen extends StatelessWidget {
  const AgendaScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final now = app.now();
    final upcoming = app.agenda.where((a) => !a.isPast(now)).toList();
    final past = app.agenda.where((a) => a.isPast(now)).toList();

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            if (app.agenda.isEmpty)
              const EmptyState(
                icon: Icons.event_note_outlined,
                title: 'Tu agenda de salud',
                message:
                    'Anotá tus próximos turnos médicos: cuándo, dónde y con quién. '
                    'Los vas a ver también en la pestaña Turno.',
              ),
            if (upcoming.isNotEmpty) ...[
              const SectionLabel('Próximos'),
              for (final a in upcoming) _AppointmentCard(app: app, appointment: a, now: now),
            ],
            if (past.isNotEmpty) ...[
              const SectionLabel('Pasados'),
              for (final a in past) _AppointmentCard(app: app, appointment: a, now: now, dimmed: true),
            ],
          ],
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton.extended(
            heroTag: 'agenda-add',
            onPressed: () => AppointmentEditor.open(context, app),
            icon: const Icon(Icons.add),
            label: const Text('Agregar turno'),
          ),
        ),
      ],
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.app, required this.appointment, required this.now, this.dimmed = false});

  final AppController app;
  final Appointment appointment;
  final DateTime now;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final a = appointment;
    final soon = !dimmed && a.at.difference(now) < const Duration(hours: 24);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Opacity(
        opacity: dimmed ? 0.6 : 1,
        child: VtCard(
          onTap: () => AppointmentEditor.open(context, app, existing: a),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(a.title, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
                  ),
                  if (soon) const Pill(label: 'Pronto', color: VtColors.warning, dot: true),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.event, size: 18, color: scheme.primary),
                  const SizedBox(width: 8),
                  Text('${dayLabel(a.at, now)} · ${hhmm(a.at)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
              if (a.place.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.place_outlined, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text(a.place)),
                  ],
                ),
              ],
              if (a.professional.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.person_outline, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Expanded(child: Text(a.professional)),
                  ],
                ),
              ],
              if (a.notes.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(a.notes, style: TextStyle(color: scheme.onSurfaceVariant, height: 1.35)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Alta y edición de un turno de la agenda (hoja inferior).
class AppointmentEditor extends StatefulWidget {
  const AppointmentEditor({super.key, required this.app, this.existing});

  final AppController app;
  final Appointment? existing;

  static Future<void> open(BuildContext context, AppController app, {Appointment? existing}) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => AppointmentEditor(app: app, existing: existing),
      );

  @override
  State<AppointmentEditor> createState() => _AppointmentEditorState();
}

class _AppointmentEditorState extends State<AppointmentEditor> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _place;
  late final TextEditingController _professional;
  late final TextEditingController _notes;
  late DateTime _at;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    final tomorrow = widget.app.now().add(const Duration(days: 1));
    _at = e?.at.toLocal() ?? DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 9);
    _title = TextEditingController(text: e?.title ?? '');
    _place = TextEditingController(text: e?.place ?? '');
    _professional = TextEditingController(text: e?.professional ?? '');
    _notes = TextEditingController(text: e?.notes ?? '');
  }

  @override
  void dispose() {
    for (final c in [_title, _place, _professional, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = widget.app.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _at,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 3),
    );
    if (d != null) setState(() => _at = DateTime(d.year, d.month, d.day, _at.hour, _at.minute));
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_at));
    if (t != null) setState(() => _at = DateTime(_at.year, _at.month, _at.day, t.hour, t.minute));
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final e = widget.existing;
    final a = Appointment(
      id: e?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
      title: _title.text.trim(),
      at: _at,
      place: _place.text.trim(),
      professional: _professional.text.trim(),
      notes: _notes.text.trim(),
    );
    await widget.app.saveAppointment(a);
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Borrar este turno?'),
        content: const Text('Se borra de tu agenda en este teléfono.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Borrar')),
        ],
      ),
    );
    if (ok != true) return;
    await widget.app.deleteAppointment(widget.existing!.id);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.existing != null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(editing ? 'Editar turno' : 'Nuevo turno', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _title,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Qué es', hintText: 'Control de cardiología'),
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Escribí de qué es el turno' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.event),
                        label: Text(shortDate(_at)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickTime,
                        icon: const Icon(Icons.schedule),
                        label: Text(hhmm(_at)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _place,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Dónde', hintText: 'Hospital, consultorio, dirección'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _professional,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Con quién', hintText: 'Dra. Fernández'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _notes,
                  maxLines: 3,
                  minLines: 1,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Notas', hintText: 'Llevar estudios, ir en ayunas…'),
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: _save, child: Text(editing ? 'Guardar cambios' : 'Agregar a mi agenda')),
                if (editing) ...[
                  const SizedBox(height: 6),
                  TextButton.icon(
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Borrar'),
                    style: TextButton.styleFrom(foregroundColor: VtColors.danger),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
