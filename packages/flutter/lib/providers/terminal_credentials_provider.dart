import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/terminal_credential.dart';
import '../services/storage_service.dart';

class TerminalCredentialsNotifier
    extends StateNotifier<List<TerminalCredential>> {
  static const _uuid = Uuid();

  TerminalCredentialsNotifier() : super(const []) {
    init();
  }

  Future<void> init() async {
    state = await StorageService.loadTerminalCredentials();
  }

  TerminalCredential add({
    required String name,
    required String host,
    required int port,
    required String username,
    String? password,
    String? privateKey,
    String? passphrase,
  }) {
    final credential = TerminalCredential(
      id: _uuid.v4(),
      name: name,
      host: host,
      port: port,
      username: username,
      password: _blankToNull(password),
      privateKey: _blankToNull(privateKey),
      passphrase: _blankToNull(passphrase),
      createdAt: DateTime.now(),
    );
    state = [...state, credential];
    _persist();
    return credential;
  }

  void update(TerminalCredential credential) {
    state = state.map((item) {
      return item.id == credential.id ? credential : item;
    }).toList();
    _persist();
  }

  void remove(String id) {
    state = state.where((item) => item.id != id).toList();
    _persist();
  }

  void _persist() {
    StorageService.saveTerminalCredentials(state);
  }

  static String? _blankToNull(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

final terminalCredentialsProvider =
    StateNotifierProvider<
      TerminalCredentialsNotifier,
      List<TerminalCredential>
    >((ref) {
      return TerminalCredentialsNotifier();
    });
