import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';

import '../models/terminal_credential.dart';
import '../providers/terminal_credentials_provider.dart';

class TerminalLoginForm extends ConsumerStatefulWidget {
  const TerminalLoginForm({
    super.key,
    required this.onConnect,
    required this.connecting,
  });

  final Future<void> Function({
    required String host,
    required int port,
    required String username,
    required String password,
    required String privateKey,
    required String passphrase,
    required bool usePrivateKey,
    required bool saveCredential,
    required String credentialName,
  }) onConnect;

  final bool connecting;

  @override
  ConsumerState<TerminalLoginForm> createState() => _TerminalLoginFormState();
}

class _TerminalLoginFormState extends ConsumerState<TerminalLoginForm> {
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '22');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _privateKeyController = TextEditingController();
  final _passphraseController = TextEditingController();
  final _nameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _saveCredential = false;
  bool _usePrivateKey = false;
  String? _selectedCredentialId;

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _privateKeyController.dispose();
    _passphraseController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _applyCredential(TerminalCredential credential) {
    _hostController.text = credential.host;
    _portController.text = credential.port.toString();
    _usernameController.text = credential.username;
    _passwordController.text = credential.password ?? '';
    _privateKeyController.text = credential.privateKey ?? '';
    _passphraseController.text = credential.passphrase ?? '';
    _nameController.text = credential.name;
    setState(() => _usePrivateKey = credential.usesPrivateKey);
  }

  void _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    await widget.onConnect(
      host: _hostController.text.trim(),
      port: int.parse(_portController.text.trim()),
      username: _usernameController.text.trim(),
      password: _passwordController.text,
      privateKey: _privateKeyController.text.trim(),
      passphrase: _passphraseController.text,
      usePrivateKey: _usePrivateKey,
      saveCredential: _saveCredential,
      credentialName: _nameController.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                          Icon(
                            Icons.terminal,
                            color: theme.colorScheme.primary,
                          ),
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
                            value == null || value.trim().isEmpty
                            ? 'terminal_username_hint'.tr()
                            : null,
                      ),
                      const SizedBox(height: 10),
                      SegmentedButton<bool>(
                        segments: [
                          ButtonSegment(
                            value: false,
                            label: Text('terminal_password_login'.tr()),
                          ),
                          ButtonSegment(
                            value: true,
                            label: Text('terminal_key_login'.tr()),
                          ),
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
                        onPressed: widget.connecting ? null : _submit,
                        icon: widget.connecting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.login),
                        label: Text(
                          widget.connecting
                              ? 'terminal_connecting'.tr()
                              : 'terminal_login'.tr(),
                        ),
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
}
