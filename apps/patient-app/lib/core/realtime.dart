import 'package:socket_io_client/socket_io_client.dart' as io;

import '../generated/vitalia_contracts.g.dart';

/// Conexión en vivo con la sala `patient:<ticketId>` del gateway: avisa el llamado al instante.
/// Si no conecta (red del hospital filtrada, servidor viejo), la app sigue con el sondeo.
abstract class PatientRealtime {
  void connect(String ticketId, {required void Function() onCalled, void Function(bool connected)? onStatus});
  void disconnect();
}

typedef RealtimeFactory = PatientRealtime Function(String baseUrl);

class SocketIoRealtime implements PatientRealtime {
  SocketIoRealtime(this.baseUrl);

  final String baseUrl;
  io.Socket? _socket;

  @override
  void connect(String ticketId, {required void Function() onCalled, void Function(bool connected)? onStatus}) {
    disconnect();
    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'ticketId': ticketId})
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(2000)
          .build(),
    );
    socket.on(VtApi.readyEvent, (_) => onStatus?.call(true));
    socket.onDisconnect((_) => onStatus?.call(false));
    socket.onConnectError((_) => onStatus?.call(false));
    socket.on(VtApi.ticketCalledEvent, (data) {
      if (data is Map && data['ticketId'] == ticketId) onCalled();
    });
    socket.connect();
    _socket = socket;
  }

  @override
  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }
}
