enum FileSourceType { sftp, ftp, storage, webdav }

class FileSourceConfig {
  final FileSourceType type;
  final String label;
  final String rootPath;
  final String host;
  final int port;
  final String username;
  final String password;
  final String baseUrl;

  const FileSourceConfig({
    required this.type,
    required this.label,
    this.rootPath = '/',
    this.host = '',
    this.port = 0,
    this.username = '',
    this.password = '',
    this.baseUrl = '',
  });

  factory FileSourceConfig.storage({String rootPath = '/'}) {
    return FileSourceConfig(
      type: FileSourceType.storage,
      label: 'Storage',
      rootPath: rootPath,
    );
  }

  factory FileSourceConfig.fromJson(Map<String, dynamic>? json) {
    if (json == null) return FileSourceConfig.storage();
    final typeIndex = json['type'] as int? ?? FileSourceType.storage.index;
    final type = FileSourceType
        .values[typeIndex.clamp(0, FileSourceType.values.length - 1)];
    return FileSourceConfig(
      type: type,
      label: json['label'] as String? ?? _defaultLabel(type),
      rootPath: json['rootPath'] as String? ?? '/',
      host: json['host'] as String? ?? '',
      port: json['port'] as int? ?? 0,
      username: json['username'] as String? ?? '',
      password: json['password'] as String? ?? '',
      baseUrl: json['baseUrl'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'type': type.index,
    'label': label,
    'rootPath': rootPath,
    'host': host,
    'port': port,
    'username': username,
    'password': password,
    'baseUrl': baseUrl,
  };

  static FileSourceConfig? maybeFromJson(Map<String, dynamic>? json) {
    return json == null ? null : FileSourceConfig.fromJson(json);
  }

  static String _defaultLabel(FileSourceType type) {
    return switch (type) {
      FileSourceType.sftp => 'SFTP',
      FileSourceType.ftp => 'FTP',
      FileSourceType.storage => 'Storage',
      FileSourceType.webdav => 'WebDAV',
    };
  }
}
