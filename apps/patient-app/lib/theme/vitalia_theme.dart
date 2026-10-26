import 'package:flutter/material.dart';

import '../generated/vitalia_contracts.g.dart';

/// Identidad Vitalia en Material 3 (`docs/06-identidad-visual.md`): teal/sky, Plus Jakarta Sans,
/// radios generosos y superficies claras. Los hex salen del código generado desde
/// `@vitalia/design-tokens`.
abstract final class VitaliaTheme {
  static const fontFamily = 'PlusJakartaSans';

  static const radiusCard = 20.0;
  static const radiusButton = 14.0;
  static const radiusInput = 13.0;

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [VtColors.primary, VtColors.secondary],
  );

  static ThemeData light() => _build(
    brightness: Brightness.light,
    bg: VtLight.bg,
    bg2: VtLight.bg2,
    paper: VtLight.paper,
    ink: VtLight.ink,
    muted: VtLight.muted,
  );

  static ThemeData dark() => _build(
    brightness: Brightness.dark,
    bg: VtDark.bg,
    bg2: VtDark.bg2,
    paper: VtDark.paper,
    ink: VtDark.ink,
    muted: VtDark.muted,
  );

  static ThemeData _build({
    required Brightness brightness,
    required Color bg,
    required Color bg2,
    required Color paper,
    required Color ink,
    required Color muted,
  }) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: VtColors.primary,
      brightness: brightness,
      primary: isDark ? VtColors.primaryLight : VtColors.primary,
      onPrimary: Colors.white,
      secondary: isDark ? VtColors.secondaryLight : VtColors.secondary,
      error: VtColors.danger,
      surface: paper,
      onSurface: ink,
      onSurfaceVariant: muted,
      surfaceContainerLowest: bg,
      surfaceContainerLow: bg2,
    );
    final stroke = VtColors.primary.withValues(alpha: isDark ? 0.24 : 0.16);
    final base = ThemeData(useMaterial3: true, brightness: brightness, colorScheme: scheme, fontFamily: fontFamily);
    final text = base.textTheme.apply(bodyColor: ink, displayColor: ink, fontFamily: fontFamily);

    return base.copyWith(
      scaffoldBackgroundColor: bg,
      textTheme: text.copyWith(
        headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.6),
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.4),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 18, fontWeight: FontWeight.w800, color: ink),
      ),
      cardTheme: CardThemeData(
        color: paper,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusCard),
          side: BorderSide(color: stroke),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusButton)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 52),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          side: BorderSide(color: scheme.primary.withValues(alpha: 0.5)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusButton)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: paper,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusInput),
          borderSide: BorderSide(color: stroke),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusInput),
          borderSide: BorderSide(color: stroke),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusInput),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        indicatorColor: VtColors.primary.withValues(alpha: isDark ? 0.28 : 0.14),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: fontFamily,
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
            color: states.contains(WidgetState.selected) ? scheme.primary : muted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? scheme.primary : muted),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: const StadiumBorder(),
        side: BorderSide(color: stroke),
        labelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, color: ink),
      ),
      dividerTheme: DividerThemeData(color: ink.withValues(alpha: 0.08), space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusButton)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: paper,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
      ),
    );
  }
}

/// Color de un nivel de triaje (`STABLE` / `ATTENTION` / `CRITICAL`).
Color triageColor(String level) => triageColors[level] ?? VtColors.success;
