# 0019. App del paciente en Flutter, en el monorepo, con sesión de turno

- Estado: Aceptado
- Fecha: 2026-10-25
- Autores: Gastón Molina

## Contexto

La tesis pide una aplicación Flutter para el paciente. Es requisito obligatorio (RF-O5, alcance 4.1, stack 9.3) y se distribuye como APK, sin tiendas. El portal cautivo en React (proyecto aparte) ya cubre el check-in al conectarse al Wi-Fi. El equipo decidió sumar igual una app Android chica, pensada como **turnero**: el turno en vivo, a dónde y con quién. Además, la app guarda los datos de salud que el paciente quiere tener a mano.

Para eso hay que resolver cuatro cosas:

- **Dónde vive el código.** La app usa los mismos contratos y la misma identidad visual que el resto del monorepo.
- **Cómo se identifica el paciente.** El paciente no tiene cuenta, y el DNI no es un secreto: cualquiera que lo sepa podría ver los signos vitales de otro.
- **Qué datos de salud se guardan, y dónde.** La Ley 25.326 los trata como datos sensibles.
- **Cómo se sigue el turno.** La app tiene que enterarse del llamado sin quedarse en vivo en segundo plano.

## Decisión

- **App en el monorepo** (`apps/patient-app`), como el firmware (ADR 0010). Nx la registra con targets `flutter-*`, para que `nx affected -t test lint build` de la CI de Node no los corra; la app tiene su propio job, con Flutter 3.44. Las etiquetas, los umbrales, los colores y las constantes se **generan** desde `@vitalia/contracts` y `@vitalia/design-tokens` con `pnpm app:codegen` (`--check` en la CI), igual que `fw:codegen` para el firmware.
- **Sesión de turno en lugar de cuenta.** `PatientSession` es un JWT de 24 h que solo da acceso a SU turno (`GET /api/patient/me` y `/me/readings`). Se firma con una clave derivada de `JWT_SECRET` (HMAC con un rótulo propio y audiencia `vitalia-patient`). Así no vale en los endpoints del personal ni en la sala `staff`, y no hay otro secreto que aprovisionar en el gateway.
- **Dos formas de obtener la sesión:**
  1. Check-in desde la app (`source: 'PATIENT_APP'`). La respuesta trae la sesión **solo si el turno se creó en ese pedido**: un check-in repetido con el mismo DNI devuelve el turno, pero sin sesión.
  2. Código de vinculación: 6 caracteres, de un solo uso, vence a los 10 min y se arma con un alfabeto sin caracteres que se confunden. El personal lo genera en el Backoffice (`POST /api/tickets/:id/pairing`) después de ver al paciente, y el paciente lo escribe en la app (`POST /api/patient/pair`, 10 intentos por minuto y por IP; con `TRUST_PROXY`, la IP es la del cliente). Los códigos viven en memoria: el gateway es una sola instancia.
- **Datos locales y cifrados.** La ficha de salud, la agenda y el historial de visitas se guardan en el teléfono con `flutter_secure_storage` (Keystore de Android) y **no se envían** al hospital ni a la nube. El servidor no recibe más datos de los que ya tenía.
- **En vivo sin segundo plano.** Con la app abierta, el llamado llega por Socket.IO (`ticket:called` en `patient:<ticketId>`) y además se consulta `/patient/me` cada 10 s, para ver la posición y la espera. En segundo plano no se consulta: el aviso fuerte del llamado sigue siendo la TV y el OLED de la pulsera.
- **Al paciente se le muestra prioridad, no triaje.** «Prioridad alta/media/habitual» (`PATIENT_PRIORITY_LABELS`), nunca «Crítico».
- **Red local en HTTP.** El manifest permite tráfico en claro hacia el gateway (no hay TLS en la LAN, igual que en el portal). La dirección del servidor se configura en Ajustes. Por defecto es `10.0.2.2:3000`, la PC vista desde el emulador.

## Alternativas consideradas

- **Repo aparte para la app.** Simplifica la CI, pero duplica contratos y marca y abre otro flujo de PR. El firmware ya mostró que se puede convivir con otro toolchain.
- **Login del paciente con DNI y PIN.** Exige alta, recupero y un almacén de credenciales para una estadía de horas. La sesión de turno alcanza y es más simple de defender.
- **Exponer el turno solo con su UUID** (como `GET /tickets/:id/public`). Sirve para datos públicos, pero no para signos vitales: un UUID viaja en capturas, links y logs.
- **Guardar la ficha de salud en el servidor.** Habría que custodiar y replicar a la nube datos que el hospital no necesita para atender. Si en el futuro hacen falta, se agregan con su contrato y con consentimiento explícito.
- **Notificaciones push con servicio en segundo plano** (RF-D1, deseable). Requiere FCM, que no funciona sin internet, o un servicio persistente en Android. Queda en el backlog.

## Consecuencias

- RF-O5 queda cubierto también con Flutter, como pide la tesis: APK directo y PWA posible más adelante con el mismo código.
- Si el gateway se reinicia, se pierden los códigos de vinculación pendientes: el personal genera otro.
- Si alguien obtiene la sesión de un turno, la puede usar durante 24 h, y el acceso no se revoca solo por terminar el turno. El riesgo está acotado a ese turno y sin DNI.
- La CI suma un job de Flutter (analyze, test y APK debug), que corre solo cuando cambia la app.
- Para cargar la app hace falta Flutter instalado. El resto del monorepo no depende de Flutter.
