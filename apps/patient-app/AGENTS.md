# AGENTS.md — apps/patient-app (Vitalia · app del paciente · Flutter)

App Android del paciente (RF-O5): **turnero** (su turno en vivo, a dónde y con quién), **mi salud** (lo que mide la pulsera mientras espera), **agenda** de turnos médicos y **ficha de salud** personal. Habla con la API del gateway por la red Wi-Fi del hospital. Reglas generales en el [AGENTS.md raíz](../../AGENTS.md); decisión en [ADR 0019](../../docs/adr/0019-app-del-paciente-en-flutter.md).

## Estructura

```
lib/
  main.dart / app.dart           # arranque, tema claro/oscuro, español (flutter_localizations)
  generated/                     # vitalia_contracts.g.dart: GENERADO con `pnpm app:codegen` (no editar)
  theme/vitalia_theme.dart       # identidad Vitalia en Material 3 (colores del código generado)
  core/
    config.dart                  # VITALIA_API_URL (--dart-define) y normalizeApiUrl()
    models.dart                  # espejo de @vitalia/contracts (patient) + modelos locales
    api_client.dart              # VitaliaApi: check-in, pair, me, readings, services, health
    realtime.dart                # Socket.IO a la sala patient:<ticketId> (aviso del llamado)
    storage.dart                 # KeyValueStore: SecureStore (Keystore) y MemoryStore (tests)
    app_controller.dart          # estado único (ChangeNotifier): sesión, sondeo, visitas, agenda, ficha
    format.dart                  # fechas y horas en español sin intl
  features/
    home_shell.dart              # 4 pestañas + Ajustes
    turno/                       # turno en vivo, sacar turno, vincular con código, mis visitas
    salud/                       # signos actuales, prioridad y curva (CustomPainter)
    agenda/                      # turnos que anota el paciente (locales)
    ficha/                       # ficha de salud local + vista «Mostrar al personal»
    ajustes/                     # servidor del hospital, desvincular, borrar datos
  widgets/common.dart            # logo, píldoras, tarjetas, estados vacíos
test/                            # flutter test: modelos, API (MockClient), controlador y widgets
android/                         # proyecto Android (applicationId ar.vitalia.paciente, minSdk 23)
assets/                          # isotipo e íconos; Plus Jakarta Sans (OFL) auto-hospedada
```

## Reglas

- **Contratos primero.** Lo que viene de la API se define en `@vitalia/contracts` (`lib/patient`) y acá se espeja en `core/models.dart`. Etiquetas, umbrales, colores y constantes salen de `lib/generated/vitalia_contracts.g.dart`: si cambian en `libs/shared`, corré `pnpm app:codegen` (la CI corre `--check`).
- **Sesión de turno, no cuenta.** El paciente no tiene usuario: usa el token de `PatientSession` (24 h, solo su turno). Se obtiene al sacar turno desde la app o con el código de 6 caracteres que genera el personal en el Backoffice. Nunca pedir ni guardar contraseñas.
- **Datos sensibles (Ley 25.326).** Todo lo del paciente se guarda con `SecureStore` (cifrado con el Keystore). La ficha de salud y la agenda **no salen del teléfono**. En la UI, el triaje se muestra como prioridad (`patientPriorityLabels`), nunca «Crítico».
- **Offline-first.** Sin CDNs ni fuentes remotas: la fuente y los íconos van en el APK. Sin red, la app muestra lo guardado (visitas, agenda, ficha) y avisa que no hay conexión con el hospital.
- **Tiempo real.** El llamado llega por WebSocket (`ticket:called` en la sala del turno) y además se consulta `GET /api/patient/me` cada 10 s con la app abierta. En segundo plano no se consulta.
- **Red.** El gateway sirve HTTP en la LAN: el manifest permite tráfico en claro. En el emulador la PC es `10.0.2.2`; en el hospital, la IP del gateway (se cambia en Ajustes).
- **Estado.** Un `AppController` (`ChangeNotifier`) y `ListenableBuilder`. Sin paquetes de estado hasta que haga falta.
- **Estilo.** `flutter_lints` + reglas de `analysis_options.yaml`, ancho 120. Textos en español rioplatense (voseo), identificadores en inglés.
- **Tests.** `flutter test` sin red: `MemoryStore`, `MockClient` de `package:http/testing.dart` y sin `realtimeFactory`.

## Comandos

```bash
pnpm app:emulator                        # levanta el AVD Pixel_8
pnpm nx serve api                        # API de desarrollo en :3000 (la app la ve en 10.0.2.2:3000)
pnpm app:run                             # flutter run en el emulador (dart-define con la URL)
pnpm nx run patient-app:run --api=http://10.0.20.1:8080   # contra el gateway del hospital
pnpm app:test                            # flutter analyze + flutter test
pnpm app:apk                             # APK de release para instalar directo (sin tiendas)
pnpm app:codegen [--check]               # regenera lib/generated desde contracts y design-tokens
```
