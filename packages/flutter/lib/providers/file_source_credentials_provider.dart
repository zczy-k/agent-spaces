import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/file_source_config.dart';
import '../models/file_source_credential.dart';
import '../services/storage_service.dart';

class FileSourceCredentialsNotifier
    extends StateNotifier<List<FileSourceCredential>> {
  static const _uuid = Uuid();

  FileSourceCredentialsNotifier() : super(const []) {
    init();
  }

  Future<void> init() async {
    state = await StorageService.loadFileSourceCredentials();
  }

  FileSourceCredential add({
    required String name,
    required FileSourceType type,
    String host = '',
    int port = 0,
    String username = '',
    String password = '',
    String baseUrl = '',
    String rootPath = '/',
  }) {
    final credential = FileSourceCredential(
      id: _uuid.v4(),
      name: name,
      type: type,
      host: host,
      port: port,
      username: username,
      password: password,
      baseUrl: baseUrl,
      rootPath: rootPath,
      createdAt: DateTime.now(),
    );
    state = [...state, credential];
    _persist();
    return credential;
  }

  void update(FileSourceCredential credential) {
    state = state.map((item) {
      return item.id == credential.id ? credential : item;
    }).toList();
    _persist();
  }

  void remove(String id) {
    state = state.where((item) => item.id != id).toList();
    _persist();
  }

  List<FileSourceCredential> byType(FileSourceType type) {
    return state.where((c) => c.type == type).toList();
  }

  void _persist() {
    StorageService.saveFileSourceCredentials(state);
  }
}

final fileSourceCredentialsProvider =
    StateNotifierProvider<FileSourceCredentialsNotifier, List<FileSourceCredential>>(
  (ref) => FileSourceCredentialsNotifier(),
);
