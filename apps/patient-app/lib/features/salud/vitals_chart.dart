import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/models.dart';
import '../../generated/vitalia_contracts.g.dart';

/// Un signo vital en la curva: rango fijo (se amplía si los datos se salen) y banda normal.
class VitalSeries {
  const VitalSeries({
    required this.label,
    required this.unit,
    required this.value,
    required this.min,
    required this.max,
    required this.normalLow,
    required this.normalHigh,
    this.decimals = 0,
  });

  final String label;
  final String unit;
  final double? Function(VitalsPoint p) value;
  final double min;
  final double max;
  final double normalLow;
  final double normalHigh;
  final int decimals;
}

/// Los tres paneles, con los mismos rangos que la curva del Backoffice.
final vitalSeries = <VitalSeries>[
  VitalSeries(
    label: 'Frecuencia cardíaca',
    unit: 'lpm',
    value: (p) => p.hr,
    min: 40,
    max: 140,
    normalLow: VtThresholds.heartRateNormalMin.toDouble(),
    normalHigh: VtThresholds.heartRateNormalMax.toDouble(),
  ),
  VitalSeries(
    label: 'Saturación de oxígeno',
    unit: '%',
    value: (p) => p.spo2,
    min: 85,
    max: 100,
    normalLow: VtThresholds.spo2NormalMin.toDouble(),
    normalHigh: 100,
  ),
  VitalSeries(
    label: 'Temperatura',
    unit: '°C',
    value: (p) => p.temp,
    min: 35,
    max: 39,
    normalLow: (VtThresholds.temperatureHypothermiaBelow + 1).toDouble(),
    normalHigh: VtThresholds.temperatureFeverAbove.toDouble(),
    decimals: 1,
  ),
];

/// Rango del eje: el fijo, ampliado si algún valor se sale.
(double, double) domainFor(VitalSeries s, List<VitalsPoint> points) {
  var lo = s.min;
  var hi = s.max;
  for (final p in points) {
    final v = s.value(p);
    if (v == null) continue;
    lo = math.min(lo, v);
    hi = math.max(hi, v);
  }
  return (lo, hi);
}

/// Panel de un signo: banda normal, línea (cortada donde faltan datos) y marcas de caída.
class VitalPanel extends StatelessWidget {
  const VitalPanel({super.key, required this.series, required this.history, this.height = 110});

  final VitalSeries series;
  final VitalsHistory history;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final values = history.points.map(series.value).whereType<double>().toList();
    final last = values.isEmpty ? null : values.last;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text(series.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
            if (last != null)
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: last.toStringAsFixed(series.decimals),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                    TextSpan(
                      text: ' ${series.unit}',
                      style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: height,
          width: double.infinity,
          child: CustomPaint(
            painter: _PanelPainter(
              series: series,
              history: history,
              line: scheme.primary,
              band: VtColors.success.withValues(alpha: 0.12),
              grid: scheme.onSurface.withValues(alpha: 0.08),
              label: scheme.onSurfaceVariant,
              fall: VtColors.danger,
            ),
          ),
        ),
      ],
    );
  }
}

class _PanelPainter extends CustomPainter {
  _PanelPainter({
    required this.series,
    required this.history,
    required this.line,
    required this.band,
    required this.grid,
    required this.label,
    required this.fall,
  });

  final VitalSeries series;
  final VitalsHistory history;
  final Color line;
  final Color band;
  final Color grid;
  final Color label;
  final Color fall;

  static const leftAxis = 34.0;

  @override
  void paint(Canvas canvas, Size size) {
    final points = history.points;
    final (lo, hi) = domainFor(series, points);
    final w = size.width - leftAxis;
    final h = size.height;
    final t0 = history.from.millisecondsSinceEpoch.toDouble();
    final span = math.max(1.0, history.to.millisecondsSinceEpoch - t0);
    double x(DateTime t) => leftAxis + (t.millisecondsSinceEpoch - t0) / span * w;
    double y(double v) => h - (v - lo) / (hi - lo) * h;

    // Banda normal y grilla con rótulos (mín, máx)
    final bandTop = y(math.min(series.normalHigh, hi));
    final bandBottom = y(math.max(series.normalLow, lo));
    canvas.drawRect(Rect.fromLTRB(leftAxis, bandTop, size.width, bandBottom), Paint()..color = band);
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (final v in [lo, hi]) {
      canvas.drawLine(Offset(leftAxis, y(v)), Offset(size.width, y(v)), gridPaint);
      _text(canvas, v.toStringAsFixed(series.decimals), Offset(0, y(v) - 7));
    }

    // Caídas: línea vertical punteada
    final fallPaint = Paint()
      ..color = fall
      ..strokeWidth = 1.5;
    for (final p in points.where((p) => p.fall)) {
      final px = x(p.at);
      for (var dy = 0.0; dy < h; dy += 6) {
        canvas.drawLine(Offset(px, dy), Offset(px, math.min(h, dy + 3)), fallPaint);
      }
    }

    // Línea, cortada si entre dos puntos pasan más de 3 intervalos (pulsera sin señal)
    final gap = Duration(seconds: history.bucketSeconds * 3);
    final path = Path();
    VitalsPoint? prev;
    for (final p in points) {
      final v = series.value(p);
      if (v == null) {
        prev = null;
        continue;
      }
      final o = Offset(x(p.at), y(v));
      if (prev == null || p.at.difference(prev.at) > gap) {
        path.moveTo(o.dx, o.dy);
      } else {
        path.lineTo(o.dx, o.dy);
      }
      prev = p;
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
  }

  void _text(Canvas canvas, String text, Offset at) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(fontSize: 10.5, color: label, fontFamily: 'PlusJakartaSans'),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: leftAxis - 4);
    tp.paint(canvas, at);
  }

  @override
  bool shouldRepaint(covariant _PanelPainter old) => old.history != history || old.line != line || old.series != series;
}

/// Rótulos de tiempo debajo de los paneles (inicio, medio, fin).
class TimeAxis extends StatelessWidget {
  const TimeAxis({super.key, required this.history});

  final VitalsHistory history;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant);
    final mid = history.from.add(history.to.difference(history.from) ~/ 2);
    return Padding(
      padding: const EdgeInsets.only(left: _PanelPainter.leftAxis, top: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(hhmm(history.from), style: style),
          Text(hhmm(mid), style: style),
          Text(hhmm(history.to), style: style),
        ],
      ),
    );
  }
}
