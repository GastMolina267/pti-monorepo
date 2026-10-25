import 'package:flutter/material.dart';

import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../theme/vitalia_theme.dart';
import '../../widgets/common.dart';
import 'check_in_screen.dart';
import 'pair_screen.dart';

/// Pestaña «Turno»: el turno de hoy en vivo (a dónde, con quién, cuánto falta) y las visitas
/// anteriores guardadas en el teléfono.
class TurnoScreen extends StatelessWidget {
  const TurnoScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final overview = app.overview;
    final now = app.now();
    final past = app.visits.where((v) => v.ticketId != app.session?.ticketId).toList();

    return RefreshIndicator(
      onRefresh: app.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          if (!app.hasSession)
            _Welcome(app: app)
          else if (overview == null)
            _Loading(app: app)
          else ...[
            if (app.calledNotice) _CalledBanner(ticket: overview.ticket, onClose: app.dismissCalled),
            _TicketHero(overview: overview, now: now),
            const SizedBox(height: 12),
            _TicketDetails(ticket: overview.ticket),
            const SizedBox(height: 10),
            _SyncLine(app: app),
            if (overview.ticket.isFinal) ...[
              const SizedBox(height: 12),
              _FinishedCard(app: app),
            ],
          ],
          if (app.upcoming.isNotEmpty) ...[
            const SectionLabel('Próximos turnos en tu agenda'),
            for (final a in app.upcoming.take(2)) _AppointmentTile(appointment: a, now: now),
          ],
          SectionLabel('Mis visitas', trailing: past.isEmpty ? null : Text('${past.length}')),
          if (past.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                'Acá vas a ver cada visita al hospital: turno, consultorio, profesional y tus últimos signos.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            )
          else
            for (final v in past)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _VisitTile(visit: v, onDelete: () => app.deleteVisit(v.ticketId)),
              ),
        ],
      ),
    );
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: VitaliaTheme.brandGradient,
            borderRadius: BorderRadius.circular(26),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.confirmation_number_outlined, color: Colors.white, size: 30),
              SizedBox(height: 14),
              Text(
                'Tu turno, siempre a mano',
                style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.5),
              ),
              SizedBox(height: 8),
              Text(
                'Conectate al Wi-Fi del hospital y sacá tu turno, o vinculá el que ya tenés. '
                'Te avisamos cuando te llamen, a qué consultorio y con quién.',
                style: TextStyle(color: Colors.white, fontSize: 15, height: 1.45),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: () => Navigator.of(context).push(CheckInScreen.route(app)),
          icon: const Icon(Icons.add_circle_outline),
          label: const Text('Sacar turno'),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push(PairScreen.route(app)),
          icon: const Icon(Icons.link),
          label: const Text('Ya tengo turno: vincular con código'),
        ),
      ],
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading({required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final error = app.error;
    if (error == null) {
      return const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()));
    }
    return EmptyState(
      icon: Icons.wifi_off_rounded,
      title: 'No pudimos ver tu turno',
      message: error,
      actions: [
        FilledButton.icon(onPressed: app.refresh, icon: const Icon(Icons.refresh), label: const Text('Reintentar')),
      ],
    );
  }
}

class _CalledBanner extends StatelessWidget {
  const _CalledBanner({required this.ticket, required this.onClose});

  final PatientTicket ticket;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final where = ticket.consultingRoomName ?? 'consultorio';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(18, 14, 8, 14),
      decoration: BoxDecoration(color: VtColors.success, borderRadius: BorderRadius.circular(20)),
      child: Row(
        children: [
          const Icon(Icons.campaign_rounded, color: Colors.white, size: 30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '¡Te llamaron!',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Andá a $where${ticket.professionalName == null ? '' : ' con ${ticket.professionalName}'}.',
                  style: const TextStyle(color: Colors.white, fontSize: 14.5, height: 1.3),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close, color: Colors.white),
            tooltip: 'Cerrar aviso',
          ),
        ],
      ),
    );
  }
}

/// Tarjeta principal con el número de turno, como la TV del hall.
class _TicketHero extends StatelessWidget {
  const _TicketHero({required this.overview, required this.now});

  final PatientOverview overview;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final t = overview.ticket;
    final (headline, detail) = switch (t.status) {
      'WAITING' => (
        t.position == 0 ? 'Sos el próximo' : '${t.position ?? '–'} ${t.position == 1 ? 'persona' : 'personas'} antes que vos',
        t.estimatedWaitMinutes == null ? 'Te avisamos cuando te llamen' : 'Espera estimada ${waitLabel(t.estimatedWaitMinutes!)}',
      ),
      'CALLED' => (
        t.consultingRoomName ?? 'Te llamaron',
        t.professionalName == null ? 'Acercate ahora' : 'Con ${t.professionalName}',
      ),
      'IN_PROGRESS' => ('En atención', t.consultingRoomName ?? ''),
      'DONE' => ('Atención finalizada', t.finishedAt == null ? '' : 'A las ${hhmm(t.finishedAt!)}'),
      'NO_SHOW' => ('No te encontramos', 'Si seguís en el hospital, acercate a recepción'),
      'CANCELLED' => ('Turno cancelado', 'Si fue un error, acercate a recepción'),
      _ => (t.statusLabel, ''),
    };

    return Container(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
      decoration: BoxDecoration(
        gradient: t.isFinal
            ? LinearGradient(colors: [VtLight.muted2, VtLight.muted2.withValues(alpha: 0.85)])
            : VitaliaTheme.brandGradient,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(color: VtColors.primary.withValues(alpha: 0.28), blurRadius: 30, offset: const Offset(0, 12)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'HOLA, ${overview.firstName.toUpperCase()} · ${t.serviceName.toUpperCase()}',
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.4),
                ),
              ),
              _HeroPill(label: t.statusLabel),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            t.code,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 64,
              fontWeight: FontWeight.w800,
              letterSpacing: -2,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 6),
          Text(headline, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
          if (detail.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(detail, style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 15.5)),
          ],
        ],
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(99)),
    child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
  );
}

class _TicketDetails extends StatelessWidget {
  const _TicketDetails({required this.ticket});

  final PatientTicket ticket;

  @override
  Widget build(BuildContext context) {
    return VtCard(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 10),
      child: Column(
        children: [
          InfoRow(icon: Icons.local_hospital_outlined, label: 'Servicio', value: ticket.serviceName),
          InfoRow(
            icon: Icons.meeting_room_outlined,
            label: 'Consultorio',
            value: ticket.consultingRoomName ?? 'Te lo decimos cuando te llamen',
          ),
          InfoRow(
            icon: Icons.person_outline,
            label: 'Profesional',
            value: ticket.professionalName ?? 'Se asigna al llamarte',
          ),
          InfoRow(
            icon: Icons.schedule,
            label: 'Llegada',
            value: '${hhmm(ticket.checkedInAt)}${ticket.calledAt == null ? '' : ' · llamado ${hhmm(ticket.calledAt!)}'}',
          ),
          if (ticket.reason != null) InfoRow(icon: Icons.notes, label: 'Motivo', value: ticket.reason!),
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 6),
            child: Row(children: [PriorityPill(ticket.triageLevel)]),
          ),
        ],
      ),
    );
  }
}

class _SyncLine extends StatelessWidget {
  const _SyncLine({required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final updated = app.lastUpdated;
    final error = app.error;
    final color = error != null ? VtColors.warning : (app.live ? VtColors.live : scheme.onSurfaceVariant);
    final text = error ?? (updated == null ? 'Actualizando…' : 'Actualizado ${ago(updated, app.now())}');
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            app.live && error == null ? '$text · en vivo' : text,
            style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant),
          ),
        ),
        if (app.refreshing) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
      ],
    );
  }
}

class _FinishedCard extends StatelessWidget {
  const _FinishedCard({required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    return VtCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Tu visita quedó guardada', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            'La vas a encontrar en «Mis visitas» con el consultorio, el profesional y tus últimos signos vitales.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
          ),
          const SizedBox(height: 14),
          FilledButton.tonal(onPressed: app.unlink, child: const Text('Cerrar este turno')),
        ],
      ),
    );
  }
}

class _AppointmentTile extends StatelessWidget {
  const _AppointmentTile({required this.appointment, required this.now});

  final Appointment appointment;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final a = appointment;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: VtCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            _DateBadge(date: a.at),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(a.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
                  const SizedBox(height: 2),
                  Text(
                    [dayLabel(a.at, now), hhmm(a.at), if (a.place.isNotEmpty) a.place].join(' · '),
                    style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateBadge extends StatelessWidget {
  const _DateBadge({required this.date});

  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final l = date.toLocal();
    return Container(
      width: 50,
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(13)),
      child: Column(
        children: [
          Text('${l.day}', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: scheme.primary)),
          Text(
            shortDate(l).split(' ')[1].toUpperCase(),
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: scheme.primary, letterSpacing: 1),
          ),
        ],
      ),
    );
  }
}

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit, required this.onDelete});

  final Visit visit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final v = visit;
    return VtCard(
      padding: const EdgeInsets.all(14),
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _VisitSheet(visit: v, onDelete: onDelete),
      ),
      child: Row(
        children: [
          _DateBadge(date: v.checkedInAt),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${v.code} · ${v.serviceName}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
                const SizedBox(height: 2),
                Text(
                  [
                    if (v.consultingRoomName != null) v.consultingRoomName!,
                    if (v.professionalName != null) v.professionalName!,
                    if (v.consultingRoomName == null && v.professionalName == null) hhmm(v.checkedInAt),
                  ].join(' · '),
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                ),
              ],
            ),
          ),
          StatusPill(v.status),
        ],
      ),
    );
  }
}

class _VisitSheet extends StatelessWidget {
  const _VisitSheet({required this.visit, required this.onDelete});

  final Visit visit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final v = visit;
    final vitals = v.lastVitals;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(v.code, style: Theme.of(context).textTheme.headlineMedium)),
                StatusPill(v.status),
              ],
            ),
            Text(longDate(v.checkedInAt), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 10),
            InfoRow(icon: Icons.local_hospital_outlined, label: 'Servicio', value: v.serviceName),
            if (v.consultingRoomName != null)
              InfoRow(icon: Icons.meeting_room_outlined, label: 'Consultorio', value: v.consultingRoomName!),
            if (v.professionalName != null)
              InfoRow(icon: Icons.person_outline, label: 'Profesional', value: v.professionalName!),
            InfoRow(
              icon: Icons.schedule,
              label: 'Horarios',
              value: [
                'llegada ${hhmm(v.checkedInAt)}',
                if (v.calledAt != null) 'llamado ${hhmm(v.calledAt!)}',
                if (v.finishedAt != null) 'fin ${hhmm(v.finishedAt!)}',
              ].join(' · '),
            ),
            if (v.reason != null) InfoRow(icon: Icons.notes, label: 'Motivo', value: v.reason!),
            if (vitals != null)
              InfoRow(
                icon: Icons.monitor_heart_outlined,
                label: 'Últimos signos (${hhmm(vitals.measuredAt)})',
                value: [
                  if (vitals.hr != null) '${vitals.hr} lpm',
                  if (vitals.spo2 != null) 'SpO₂ ${vitals.spo2} %',
                  if (vitals.temp != null) '${vitals.temp!.toStringAsFixed(1)} °C',
                ].join(' · '),
              ),
            const SizedBox(height: 8),
            Row(children: [PriorityPill(v.triageLevel)]),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  onDelete();
                },
                icon: const Icon(Icons.delete_outline),
                label: const Text('Borrar de mis visitas'),
                style: TextButton.styleFrom(foregroundColor: VtColors.danger),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
