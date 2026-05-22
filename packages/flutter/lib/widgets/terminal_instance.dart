import 'dart:async';
import 'dart:convert';

import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:xterm/xterm.dart';
import 'package:easy_localization/easy_localization.dart';

import '../models/browser_tab.dart';
import '../models/terminal_credential.dart';
import '../providers/terminal_credentials_provider.dart';

class TerminalInstance extends ConsumerStatefulWidget {
  final BrowserTab tab;
  final ValueChanged<String>? onTitleChanged;

  const TerminalInstance({super.key, required this.tab, this.onTitleChanged});

  @override
  ConsumerState<TerminalInstance> createState() => _TerminalInstanceState();
}

class _TerminalInstanceState extends ConsumerState<TerminalInstance> {
  late final Terminal _terminal;
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '22');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _privateKeyController = TextEditingController();
  final _passphraseController = TextEditingController();
  final _nameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  SSHClient? _client;
  SSHSession? _session;
  StreamSubscription<String>? _stdoutSubscription;
  StreamSubscription<String>? _stderrSubscription;
  bool _connecting = false;
  bool _connected = false;
  bool _saveCredential = false;
  bool _usePrivateKey = false;
  String? _selectedCredentialId;

  @override
  void initState() {
    super.initState();
    _terminal = Terminal();
    _terminal.onTitleChange = (title) {
      widget.onTitleChanged?.call(title.isEmpty ? 'Terminal' : title);
    };
  }

  @override
  void dispose() {
    _disconnect();
    _hostController.dispose();
    _portController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _privateKeyController.dispose();
    _passphraseController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_connected) {
      return _buildLoginPlaceholder(context);
    }

    return ColoredBox(
      color: Colors.black,
      child: TerminalView(
        _terminal,
        autofocus: true,
        padding: const EdgeInsets.all(8),
        backgroundOpacity: 1,
      ),
    );
  }

  Widget _buildLoginPlaceholder(BuildContext context) {
    final theme = Theme.of(context);
    final credentials = ref.watch(terminalCredentialsProvider);

    return SizedBox.expand(
      child: ColoredBox(
        color: theme.colorScheme.surface,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Card(
              margin: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.terminal, color: theme.colorScheme.primary),
                          const SizedBox(width: 10),
                          Text(
                            'terminal_new'.tr(),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      if (credentials.isNotEmpty) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _selectedCredentialId,
                          decoration: InputDecoration(
                            labelText: 'terminal_select_saved_credential'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          items: credentials
                              .map(
                                (credential) => DropdownMenuItem(
                                  value: credential.id,
                                  child: Text(
                                    '${credential.name} (${credential.username}@${credential.host}:${credential.port})',
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (id) {
                            final credential = credentials.firstWhere(
                              (item) => item.id == id,
                            );
                            setState(() {
                              _selectedCredentialId = id;
                              _applyCredential(credential);
                            });
                          },
                        ),
                        const SizedBox(height: 14),
                      ],
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: TextFormField(
                              controller: _hostController,
                              decoration: InputDecoration(
                                labelText: 'terminal_host'.tr(),
                                hintText: 'example.com',
                                border: const OutlineInputBorder(),
                              ),
                              validator: (value) =>
                                  value == null || value.trim().isEmpty
                                  ? 'terminal_host_hint'.tr()
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _portController,
                              decoration: InputDecoration(
                                labelText: 'terminal_port'.tr(),
                                border: const OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.number,
                              validator: (value) {
                                final port = int.tryParse(value ?? '');
                                if (port == null || port <= 0 || port > 65535) {
                                  return 'terminal_port_invalid'.tr();
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          labelText: 'terminal_username'.tr(),
                          border: const OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            value == null || value.trim().isEmpty ? 'terminal_username_hint'.tr() : null,
                      ),
                      const SizedBox(height: 10),
                      SegmentedButton<bool>(
                        segments: [
                          ButtonSegment(value: false, label: Text('terminal_password_login'.tr())),
                          ButtonSegment(value: true, label: Text('terminal_key_login'.tr())),
                        ],
                        selected: {_usePrivateKey},
                        onSelectionChanged: (values) {
                          setState(() => _usePrivateKey = values.first);
                        },
                      ),
                      const SizedBox(height: 14),
                      if (_usePrivateKey) ...[
                        TextFormField(
                          controller: _privateKeyController,
                          decoration: InputDecoration(
                            labelText: 'terminal_private_key_pem'.tr(),
                            hintText: '-----BEGIN OPENSSH PRIVATE KEY-----',
                            border: const OutlineInputBorder(),
                          ),
                          minLines: 4,
                          maxLines: 8,
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'terminal_private_key_hint'.tr()
                              : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passphraseController,
                          decoration: InputDecoration(
                            labelText: 'terminal_key_passphrase'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                        ),
                      ] else
                        TextFormField(
                          controller: _passwordController,
                          decoration: InputDecoration(
                            labelText: 'terminal_password'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                        ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('terminal_save_credential'.tr()),
                        subtitle: Text('terminal_save_credential_desc'.tr()),
                        value: _saveCredential,
                        onChanged: (value) =>
                            setState(() => _saveCredential = value),
                      ),
                      if (_saveCredential) ...[
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _nameController,
                          decoration: InputDecoration(
                            labelText: 'terminal_credential_name'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _connecting ? null : _connect,
                        icon: _connecting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.login),
                        label: Text(_connecting ? 'terminal_connecting'.tr() : 'terminal_login'.tr()),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _applyCredential(TerminalCredential credential) {
    _hostController.text = credential.host;
    _portController.text = credential.port.toString();
    _usernameController.text = credential.username;
    _passwordController.text = credential.password ?? '';
    _privateKeyController.text = credential.privateKey ?? '';
    _passphraseController.text = credential.passphrase ?? '';
    _nameController.text = credential.name;
    _usePrivateKey = credential.usesPrivateKey;
  }

  Future<void> _connect() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final host = _hostController.text.trim();
    final port = int.parse(_portController.text.trim());
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final privateKey = _privateKeyController.text.trim();
    final passphrase = _passphraseController.text;

    setState(() => _connecting = true);
    _terminal.write('Connecting to $host:$port...\r\n');

    try {
      final identities = _usePrivateKey
          ? SSHKeyPair.fromPem(
              privateKey,
              passphrase.trim().isEmpty ? null : passphrase,
            )
          : null;
      final client = SSHClient(
        await SSHSocket.connect(host, port),
        username: username,
        onPasswordRequest: _usePrivateKey ? null : () => password,
        identities: identities,
      );
      final session = await client.shell(
        pty: SSHPtyConfig(
          width: _terminal.viewWidth,
          height: _terminal.viewHeight,
        ),
      );

      _client = client;
      _session = session;
      _terminal.buffer.clear();
      _terminal.buffer.setCursor(0, 0);
      _terminal.onOutput = (data) => session.write(utf8.encode(data));
      _terminal.onResize = (width, height, pixelWidth, pixelHeight) {
        session.resizeTerminal(width, height, pixelWidth, pixelHeight);
      };
      _stdoutSubscription = session.stdout
          .cast<List<int>>()
          .transform(const Utf8Decoder())
          .listen(_terminal.write);
      _stderrSubscription = session.stderr
          .cast<List<int>>()
          .transform(const Utf8Decoder())
          .listen(_terminal.write);
      session.done.whenComplete(() {
        if (!mounted) return;
        _terminal.write('\r\n[Disconnected]\r\n');
        setState(() => _connected = false);
      });

      if (_saveCredential) {
        ref
            .read(terminalCredentialsProvider.notifier)
            .add(
              name: _credentialName(host, username),
              host: host,
              port: port,
              username: username,
              password: _usePrivateKey ? null : password,
              privateKey: _usePrivateKey ? privateKey : null,
              passphrase: _usePrivateKey ? passphrase : null,
            );
      }

      if (!mounted) return;
      setState(() {
        _connected = true;
        _connecting = false;
      });
      widget.onTitleChanged?.call('$username@$host');
    } catch (error) {
      _client?.close();
      _client = null;
      _session = null;
      if (!mounted) return;
      setState(() => _connecting = false);
      _terminal.write('Connection failed: $error\r\n');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('terminal_connection_failed'.tr(args: [error.toString()]))));
    }
  }

  String _credentialName(String host, String username) {
    final name = _nameController.text.trim();
    return name.isEmpty ? '$username@$host' : name;
  }

  void _disconnect() {
    _stdoutSubscription?.cancel();
    _stderrSubscription?.cancel();
    _session?.close();
    _client?.close();
    _session = null;
    _client = null;
  }
}
