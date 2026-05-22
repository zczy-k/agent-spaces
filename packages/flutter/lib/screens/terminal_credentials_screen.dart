import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/terminal_credential.dart';
import '../providers/terminal_credentials_provider.dart';

class TerminalCredentialsScreen extends ConsumerWidget {
  const TerminalCredentialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final credentials = ref.watch(terminalCredentialsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Terminal 凭证管理'),
        actions: [
          IconButton(
            tooltip: '新增凭证',
            icon: const Icon(Icons.add),
            onPressed: () => _showCredentialDialog(context, ref),
          ),
        ],
      ),
      body: credentials.isEmpty
          ? const Center(child: Text('暂无保存的 Terminal 凭证'))
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
                    '${credential.username}@${credential.host}:${credential.port} · ${credential.usesPrivateKey ? '私钥' : '密码'}登录',
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (value) {
                      if (value == 'edit') {
                        _showCredentialDialog(context, ref, credential);
                      } else if (value == 'delete') {
                        _confirmDelete(context, ref, credential);
                      }
                    },
                    itemBuilder: (context) => const [
                      PopupMenuItem(value: 'edit', child: Text('编辑')),
                      PopupMenuItem(value: 'delete', child: Text('删除')),
                    ],
                  ),
                  onTap: () => _showCredentialDialog(context, ref, credential),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCredentialDialog(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('新增凭证'),
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
        title: const Text('删除凭证'),
        content: Text('确定删除「${credential.name}」吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除'),
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
          title: Text(credential == null ? '新增凭证' : '编辑凭证'),
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
                      decoration: const InputDecoration(labelText: '名称'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? '请输入名称'
                          : null,
                    ),
                    TextFormField(
                      controller: hostController,
                      decoration: const InputDecoration(labelText: '主机'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? '请输入主机'
                          : null,
                    ),
                    TextFormField(
                      controller: portController,
                      decoration: const InputDecoration(labelText: '端口'),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        final port = int.tryParse(value ?? '');
                        if (port == null || port <= 0 || port > 65535) {
                          return '端口无效';
                        }
                        return null;
                      },
                    ),
                    TextFormField(
                      controller: usernameController,
                      decoration: const InputDecoration(labelText: '用户名'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? '请输入用户名'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: false, label: Text('密码')),
                        ButtonSegment(value: true, label: Text('私钥')),
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
                        decoration: const InputDecoration(labelText: '私钥 PEM'),
                        minLines: 4,
                        maxLines: 8,
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? '请输入私钥'
                            : null,
                      ),
                      TextFormField(
                        controller: passphraseController,
                        decoration: const InputDecoration(labelText: '私钥口令'),
                        obscureText: true,
                      ),
                    ] else
                      TextFormField(
                        controller: passwordController,
                        decoration: const InputDecoration(labelText: '密码'),
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
              child: const Text('取消'),
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
              child: const Text('保存'),
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
