import 'package:flutter/material.dart';

import '../generated/vitalia_contracts.g.dart';
import '../theme/vitalia_theme.dart';

/// Isotipo + «Vitalia» (con «ia» en el color de la marca, como en el Backoffice y la TV).
class VitaliaLogo extends StatelessWidget {
  const VitaliaLogo({super.key, this.size = 32, this.showName = true, this.subtitle});

  final double size;
  final bool showName;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset('assets/brand/vitalia-isotipo.png', width: size, height: size, semanticLabel: 'Vitalia'),
        if (showName) ...[
          SizedBox(width: size * 0.3),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'Vital'),
                    TextSpan(
                      text: 'ia',
                      style: TextStyle(color: scheme.secondary),
                    ),
                  ],
                ),
                style: TextStyle(fontSize: size * 0.56, fontWeight: FontWeight.w800, letterSpacing: -0.4, height: 1.1),
              ),
              if (subtitle != null)
                Text(
                  subtitle!.toUpperCase(),
                  style: TextStyle(
                    fontSize: size * 0.26,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Título de sección chico, en mayúsculas, con la raya de la marca (como el Backoffice).
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
      child: Row(
        children: [
          Container(width: 14, height: 2, color: scheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text.toUpperCase(),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.6, color: scheme.primary),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Píldora de color con texto (estado del turno, prioridad).
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color, this.icon, this.dot = false});

  final String label;
  final Color color;
  final IconData? icon;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fg = isDark ? Color.lerp(color, Colors.white, 0.35)! : Color.lerp(color, Colors.black, 0.25)!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.22 : 0.13),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 5)],
          Text(
            label,
            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: fg),
          ),
        ],
      ),
    );
  }
}

/// Prioridad de atención para el paciente: nunca dice «Crítico», dice «Prioridad alta».
class PriorityPill extends StatelessWidget {
  const PriorityPill(this.level, {super.key});

  final String level;

  @override
  Widget build(BuildContext context) =>
      Pill(label: patientPriorityLabels[level] ?? level, color: triageColor(level), dot: true);
}

/// Color del estado del turno.
Color statusColor(String status) => switch (status) {
  'WAITING' => VtColors.secondary,
  'CALLED' => VtColors.primary,
  'IN_PROGRESS' => VtColors.indigo,
  'DONE' => VtColors.success,
  'NO_SHOW' || 'CANCELLED' => VtLight.muted2,
  _ => VtLight.muted2,
};

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) =>
      Pill(label: ticketStatusLabels[status] ?? status, color: statusColor(status), dot: true);
}

/// Estado vacío con ícono, título, texto y acciones.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.actions = const [],
  });

  final IconData icon;
  final String title;
  final String message;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 12),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, size: 30, color: scheme.primary),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: scheme.onSurfaceVariant, height: 1.45),
          ),
          if (actions.isNotEmpty) ...[const SizedBox(height: 20), ...actions],
        ],
      ),
    );
  }
}

/// Fila «etiqueta: valor» con ícono.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: scheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta con padding estándar.
class VtCard extends StatelessWidget {
  const VtCard({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

/// Muestra un mensaje breve abajo.
void showMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
