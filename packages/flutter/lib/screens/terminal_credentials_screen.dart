import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';

import '../models/terminal_credential.dart';
import '../providers/terminal_credentials_provider.dart';

class TerminalCredentialsScreen extends ConsumerWidget {
  const TerminalCredentialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final credentials = ref.watch(terminalCredentialsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('terminal_credentials'.tr()),
        actions: [
          IconButton(
            tooltip: 'terminal_credential_add'.tr(),
            icon: const Icon(Icons.add),
            onPressed: () => _showCredentialDialog(context, ref),
          ),
        ],
      ),
      body: credentials.isEmpty
          ? Center(child: Text('terminal_credential_empty'.tr()))
          : ListView.separated(
              itemCount: credentials.length,
              separatorBuilder: (_, separatorIndex) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final credential = credentials[index];
                return ListTile(
                  leading: Icon(
                    credential.usesPrivateKey ? Icons.key : Icons.password,
                  ),
                  title: Text(credential.name),
                  subtitle: Text(
                    '${credential.username}@${credential.host}:${credential.port} · ${credential.usesPrivateKey ? 'terminal_private_key'.tr() : 'terminal_password'.tr()}',
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'edit') {
                        _showCredentialDialog(context, ref, credential);
                      } else if (value == 'delete') {
                        _confirmDelete(context, ref, credential);
                      }
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(value: 'edit', child: Text('edit'.tr())),
                      PopupMenuItem(value: 'delete', child: Text('delete'.tr())),
                    ],
                  ),
                  onTap: () => _showCredentialDialog(context, ref, credential),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCredentialDialog(context, ref),
        icon: const Icon(Icons.add),
        label: Text('terminal_credential_add'.tr()),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    TerminalCredential credential,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('terminal_credential_delete_title'.tr()),
        content: Text('terminal_credential_delete_confirm'.tr(args: [credential.name])),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text('cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('delete'.tr()),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(terminalCredentialsProvider.notifier).remove(credential.id);
    }
  }

  Future<void> _showCredentialDialog(
    BuildContext context,
    WidgetRef ref, [
    TerminalCredential? credential,
  ]) async {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: credential?.name ?? '');
    final hostController = TextEditingController(text: credential?.host ?? '');
    final portController = TextEditingController(
      text: (credential?.port ?? 22).toString(),
    );
    final usernameController = TextEditingController(
      text: credential?.username ?? '',
    );
    final passwordController = TextEditingController(
      text: credential?.password ?? '',
    );
    final privateKeyController = TextEditingController(
      text: credential?.privateKey ?? '',
    );
    final passphraseController = TextEditingController(
      text: credential?.passphrase ?? '',
    );
    var usePrivateKey = credential?.usesPrivateKey ?? false;

    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(credential == null ? 'terminal_credential_add'.tr() : 'terminal_credential_edit'.tr()),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameController,
                      decoration: InputDecoration(labelText: 'terminal_credential_name_label'.tr()),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'terminal_credential_name_hint'.tr()
                          : null,
                    ),
                    TextFormField(
                      controller: hostController,
                      decoration: InputDecoration(labelText: 'terminal_credential_host_label'.tr()),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'terminal_credential_host_hint'.tr()
                          : null,
                    ),
                    TextFormField(
                      controller: portController,
                      decoration: InputDecoration(labelText: 'terminal_credential_port_label'.tr()),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        final port = int.tryParse(value ?? '');
                        if (port == null || port <= 0 || port > 65535) {
                          return 'terminal_port_invalid'.tr();
                        }
                        return null;
                      },
                    ),
                    TextFormField(
                      controller: usernameController,
                      decoration: InputDecoration(labelText: 'terminal_credential_username_label'.tr()),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'terminal_credential_username_hint'.tr()
                          : null,
                    ),
                    const SizedBox(height: 12),
                    SegmentedButton<bool>(
                      segments: [
                        ButtonSegment(value: false, label: Text('terminal_password'.tr())),
                        ButtonSegment(value: true, label: Text('terminal_private_key'.tr())),
                      ],
                      selected: {usePrivateKey},
                      onSelectionChanged: (values) {
                        setState(() => usePrivateKey = values.first);
                      },
                    ),
                    const SizedBox(height: 8),
                    if (usePrivateKey) ...[
                      TextFormField(
                        controller: privateKeyController,
                        decoration: InputDecoration(labelText: 'terminal_private_key_pem'.tr()),
                        minLines: 4,
                        maxLines: 8,
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? 'terminal_private_key_hint'.tr()
                            : null,
                      ),
                      TextFormField(
                        controller: passphraseController,
                        decoration: InputDecoration(labelText: 'terminal_key_passphrase'.tr()),
                        obscureText: true,
                      ),
                    ] else
                      TextFormField(
                        controller: passwordController,
                        decoration: InputDecoration(labelText: 'terminal_password'.tr()),
                        obscureText: true,
                      ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('cancel'.tr()),
            ),
            FilledButton(
              onPressed: () {
                if (!(formKey.currentState?.validate() ?? false)) return;
                final notifier = ref.read(terminalCredentialsProvider.notifier);
                final nextCredential = TerminalCredential(
                  id:
                      credential?.id ??
                      DateTime.now().microsecondsSinceEpoch.toString(),
                  name: nameController.text.trim(),
                  host: hostController.text.trim(),
                  port: int.parse(portController.text.trim()),
                  username: usernameController.text.trim(),
                  password: usePrivateKey
                      ? null
                      : _blankToNull(passwordController.text),
                  privateKey: usePrivateKey
                      ? _blankToNull(privateKeyController.text)
                      : null,
                  passphrase: usePrivateKey
                      ? _blankToNull(passphraseController.text)
                      : null,
                  createdAt: credential?.createdAt ?? DateTime.now(),
                );
                if (credential == null) {
                  notifier.add(
                    name: nextCredential.name,
                    host: nextCredential.host,
                    port: nextCredential.port,
                    username: nextCredential.username,
                    password: nextCredential.password,
                    privateKey: nextCredential.privateKey,
                    passphrase: nextCredential.passphrase,
                  );
                } else {
                  notifier.update(nextCredential);
                }
                Navigator.of(context).pop();
              },
              child: Text('save'.tr()),
            ),
          ],
        ),
      ),
    );

    nameController.dispose();
    hostController.dispose();
    portController.dispose();
    usernameController.dispose();
    passwordController.dispose();
    privateKeyController.dispose();
    passphraseController.dispose();
  }

  String? _blankToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}
