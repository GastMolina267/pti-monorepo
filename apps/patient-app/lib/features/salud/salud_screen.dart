import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/app_controller.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../generated/vitalia_contracts.g.dart';
import '../../theme/vitalia_theme.dart';
import '../../widgets/common.dart';
import 'vitals_chart.dart';

/// Pestaña «Mi salud»: lo que mide la pulsera mientras esperás (signos, prioridad y curva) y,
/// sin turno activo, los últimos signos de cada visita.
class SaludScreen extends StatelessWidget {
  const SaludScreen({super.key, required this.app});

  final AppController app;

  @override
  Widget build(BuildContext context) {
    final overview = app.overview;
    final vitals = overview?.vitals;
    final withVitals = app.visits.where((v) => v.lastVitals != null).toList();

    return RefreshIndicator(
      onRefresh: app.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          if (overview == null)
            const EmptyState(
              icon: Icons.monitor_heart_outlined,
              title: 'Tus signos vitales',
              message:
                  'Cuando tengas un turno y el personal te dé una pulsera Vitalia, acá vas a ver tu '
                  'frecuencia cardíaca, oxigenación y temperatura mientras esperás.',
            )
          else if (vitals == null)
            const EmptyState(
              icon: Icons.watch_outlined,
              title: 'Todavía sin pulsera',
              message:
                  'Si el personal te asigna una pulsera, tus signos aparecen acá en unos segundos. '
                  'No hace falta que hagas nada.',
            )
          else ...[
            _VitalsNow(vitals: vitals, now: app.now()),
            const SizedBox(height: 12),
            _CurveCard(app: app, ticketId: overview.ticket.id),
            const SizedBox(height: 12),
            const _Disclaimer(),
          ],
          if (withVitals.isNotEmpty) ...[
            const SectionLabel('En visitas anteriores'),
            for (final v in withVitals.where((v) => v.ticketId != overview?.ticket.id)) _VisitVitals(visit: v),
          ],
        ],
      ),
    );
  }
}

class _VitalsNow extends StatelessWidget {
  const _VitalsNow({required this.vitals, required this.now});

  final PatientVitals vitals;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final level = vitals.level;
    return VtCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Ahora', style: Theme.of(context).textTheme.titleLarge)),
              PriorityPill(level),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Pulsera ${vitals.wearableCode} · ${ago(vitals.measuredAt, now)}',
            style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _Metric(icon: Icons.favorite_outline, label: 'Pulso', value: vitals.hr?.toString(), unit: 'lpm'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Metric(
                  icon: Icons.water_drop_outlined,
                  label: 'SpO₂',
                  value: vitals.spo2?.toString(),
                  unit: '%',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Metric(
                  icon: Icons.thermostat_outlined,
                  label: 'Temp.',
                  value: vitals.temp?.toStringAsFixed(1),
                  unit: '°C',
                ),
              ),
            ],
          ),
          if (vitals.reasons.isNotEmpty || vitals.fall) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: triageColor(level).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Text(
                '${vitals.reasons.join(' · ')}\nEl personal ya lo está viendo en la consola.',
                style: const TextStyle(height: 1.4, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.label, required this.value, required this.unit});

  final IconData icon;
  final String label;
  final String? value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: scheme.primary),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: scheme.onSurfaceVariant),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: value ?? '–',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                ),
                TextSpan(
                  text: ' $unit',
                  style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Curva de la espera con ventana elegible. Se vuelve a pedir cada 30 s.
class _CurveCard extends StatefulWidget {
  const _CurveCard({required this.app, required this.ticketId});

  final AppController app;
  final String ticketId;

  @override
  State<_CurveCard> createState() => _CurveCardState();
}

class _CurveCardState extends State<_CurveCard> {
  static const windows = [(30, '30 min'), (120, '2 h'), (480, '8 h')];

  int _minutes = 120;
  VitalsHistory? _history;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => unawaited(_load()));
  }

  @override
  void didUpdateWidget(covariant _CurveCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ticketId != widget.ticketId) unawaited(_load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final h = await widget.app.readings(_minutes);
      if (!mounted) return;
      setState(() {
        _history = h;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = _history;
    return VtCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Tu curva', style: Theme.of(context).textTheme.titleLarge)),
              SegmentedButton<int>(
                showSelectedIcon: false,
                style: const ButtonStyle(visualDensity: VisualDensity.compact),
                segments: [for (final (m, label) in windows) ButtonSegment(value: m, label: Text(label))],
                selected: {_minutes},
                onSelectionChanged: (s) {
                  setState(() => _minutes = s.first);
                  unawaited(_load());
                },
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (history == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (history == null)
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))
          else if (history.points.isEmpty)
            const Text('Sin lecturas en esta ventana.')
          else ...[
            for (final s in vitalSeries) ...[
              VitalPanel(series: s, history: history, height: 92),
              const SizedBox(height: 14),
            ],
            TimeAxis(history: history),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(width: 14, height: 10, color: VtColors.success.withValues(alpha: 0.18)),
                const SizedBox(width: 6),
                const Text('rango normal', style: TextStyle(fontSize: 12)),
                const SizedBox(width: 14),
                Container(width: 2, height: 12, color: VtColors.danger),
                const SizedBox(width: 6),
                const Text('caída', style: TextStyle(fontSize: 12)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Disclaimer extends StatelessWidget {
  const _Disclaimer();

  @override
  Widget build(BuildContext context) => Text(
    'Estos valores son orientativos y los revisa el equipo de salud. Si te sentís mal, avisá al personal.',
    style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4),
  );
}

class _VisitVitals extends StatelessWidget {
  const _VisitVitals({required this.visit});

  final Visit visit;

  @override
  Widget build(BuildContext context) {
    final v = visit.lastVitals!;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: VtCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(Icons.monitor_heart_outlined, color: scheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${shortDate(visit.checkedInAt)} · ${visit.serviceName}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (v.hr != null) '${v.hr} lpm',
                      if (v.spo2 != null) 'SpO₂ ${v.spo2} %',
                      if (v.temp != null) '${v.temp!.toStringAsFixed(1)} °C',
                    ].join(' · '),
                    style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                  ),
                ],
              ),
            ),
            PriorityPill(v.level),
          ],
        ),
      ),
    );
  }
}
