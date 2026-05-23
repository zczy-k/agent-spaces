import 'file_source_config.dart';

class FileSourceCredential {
  final String id;
  final String name;
  final FileSourceType type;
  final String host;
  final int port;
  final String username;
  final String password;
  final String baseUrl;
  final String rootPath;
  final DateTime createdAt;

  const FileSourceCredential({
    required this.id,
    required this.name,
    required this.type,
    this.host = '',
    this.port = 0,
    this.username = '',
    this.password = '',
    this.baseUrl = '',
    this.rootPath = '/',
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type.index,
    'host': host,
    'port': port,
    'username': username,
    'password': password,
    'baseUrl': baseUrl,
    'rootPath': rootPath,
    'createdAt': createdAt.toIso8601String(),
  };

  factory FileSourceCredential.fromJson(Map<String, dynamic> json) {
    final typeIndex = json['type'] as int? ?? 0;
    return FileSourceCredential(
      id: json['id'] as String,
      name: json['name'] as String,
      type: FileSourceType.values[typeIndex.clamp(0, FileSourceType.values.length - 1)],
      host: json['host'] as String? ?? '',
      port: json['port'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      password: json['password'] as String? ?? '',
      baseUrl: json['baseUrl'] as String? ?? '',
      rootPath: json['rootPath'] as String? ?? '/',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  FileSourceCredential copyWith({
    String? name,
    String? host,
    int? port,
    String? username,
    String? password,
    String? baseUrl,
    String? rootPath,
  }) {
    return FileSourceCredential(
      id: id,
      name: name ?? this.name,
      type: type,
      host: host ?? this.host,
      port: port ?? this.port,
      username: username ?? this.username,
      password: password ?? this.password,
      baseUrl: baseUrl ?? this.baseUrl,
      rootPath: rootPath ?? this.rootPath,
      createdAt: createdAt,
    );
  }

  String get summary {
    switch (type) {
      case FileSourceType.sftp:
      case FileSourceType.ftp:
        return '$username@$host:$port';
      case FileSourceType.webdav:
        return baseUrl.isNotEmpty ? '$username@$baseUrl' : username;
      case FileSourceType.storage:
        return rootPath;
    }
  }

  FileSourceConfig toConfig({String? label}) {
    return FileSourceConfig(
      type: type,
      label: label ?? name,
      rootPath: rootPath,
      host: host,
      port: port,
      username: username,
      password: password,
      baseUrl: baseUrl,
    );
  }
}
