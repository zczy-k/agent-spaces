class TerminalCredential {
  final String id;
  final String name;
  final String host;
  final int port;
  final String username;
  final String? password;
  final String? privateKey;
  final String? passphrase;
  final DateTime createdAt;

  const TerminalCredential({
    required this.id,
    required this.name,
    required this.host,
    required this.port,
    required this.username,
    this.password,
    this.privateKey,
    this.passphrase,
    required this.createdAt,
  });

  bool get usesPrivateKey =>
      privateKey != null && privateKey!.trim().isNotEmpty;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'host': host,
    'port': port,
    'username': username,
    'password': password,
    'privateKey': privateKey,
    'passphrase': passphrase,
    'createdAt': createdAt.toIso8601String(),
  };

  factory TerminalCredential.fromJson(Map<String, dynamic> json) {
    return TerminalCredential(
      id: json['id'] as String,
      name: json['name'] as String,
      host: json['host'] as String,
      port: json['port'] as int,
      username: json['username'] as String,
      password: json['password'] as String?,
      privateKey: json['privateKey'] as String?,
      passphrase: json['passphrase'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  TerminalCredential copyWith({
    String? name,
    String? host,
    int? port,
    String? username,
    String? password,
    String? privateKey,
    String? passphrase,
  }) {
    return TerminalCredential(
      id: id,
      name: name ?? this.name,
      host: host ?? this.host,
      port: port ?? this.port,
      username: username ?? this.username,
      password: password ?? this.password,
      privateKey: privateKey ?? this.privateKey,
      passphrase: passphrase ?? this.passphrase,
      createdAt: createdAt,
    );
  }
}
