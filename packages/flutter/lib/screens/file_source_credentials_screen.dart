import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';

import '../models/file_source_config.dart';
import '../models/file_source_credential.dart';
import '../providers/file_source_credentials_provider.dart';
import '../services/file_sources/webdav_url.dart';

class FileSourceCredentialsScreen extends ConsumerWidget {
  const FileSourceCredentialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: Text('file_source_credentials'.tr()),
          bottom: TabBar(
            tabs: [
              Tab(text: 'SFTP'),
              Tab(text: 'FTP'),
              Tab(text: 'WebDAV'),
            ],
          ),
          actions: [
            IconButton(
              tooltip: 'file_source_credential_add'.tr(),
              icon: const Icon(Icons.add),
              onPressed: () {
                final type = _typeFromTabIndex(
                  DefaultTabController.of(context).index,
                );
                _showCredentialDialog(context, ref, type);
              },
            ),
          ],
        ),
        body: TabBarView(
          children: [
            _buildList(context, ref, FileSourceType.sftp),
            _buildList(context, ref, FileSourceType.ftp),
            _buildList(context, ref, FileSourceType.webdav),
          ],
        ),
        floatingActionButton: Builder(
          builder: (context) {
            final tabIndex = DefaultTabController.of(context).index;
            final type = _typeFromTabIndex(tabIndex);
            return FloatingActionButton.extended(
              onPressed: () => _showCredentialDialog(context, ref, type),
              icon: const Icon(Icons.add),
              label: Text('file_source_credential_add'.tr()),
            );
          },
        ),
      ),
    );
  }

  FileSourceType _typeFromTabIndex(int index) {
    return switch (index) {
      1 => FileSourceType.ftp,
      2 => FileSourceType.webdav,
      _ => FileSourceType.sftp,
    };
  }

  Widget _buildList(BuildContext context, WidgetRef ref, FileSourceType type) {
    final credentials = ref
        .watch(fileSourceCredentialsProvider)
        .where((c) => c.type == type)
        .toList();

    if (credentials.isEmpty) {
      return Center(child: Text('file_source_credential_empty'.tr()));
    }

    return ListView.separated(
      itemCount: credentials.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final credential = credentials[index];
        return ListTile(
          leading: Icon(_typeIcon(credential.type)),
          title: Text(credential.name),
          subtitle: Text(credential.summary),
          trailing: PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'edit') {
                _showCredentialDialog(context, ref, type, credential);
              } else if (value == 'delete') {
                _confirmDelete(context, ref, credential);
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(value: 'edit', child: Text('edit'.tr())),
              PopupMenuItem(value: 'delete', child: Text('delete'.tr())),
            ],
          ),
          onTap: () => _showCredentialDialog(context, ref, type, credential),
        );
      },
    );
  }

  IconData _typeIcon(FileSourceType type) {
    return switch (type) {
      FileSourceType.sftp => Icons.security,
      FileSourceType.ftp => Icons.cloud_queue,
      FileSourceType.webdav => Icons.cloud_sync_outlined,
      FileSourceType.storage => Icons.storage,
    };
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    FileSourceCredential credential,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('file_source_credential_delete_title'.tr()),
        content: Text(
          'file_source_credential_delete_confirm'.tr(args: [credential.name]),
        ),
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
      ref.read(fileSourceCredentialsProvider.notifier).remove(credential.id);
    }
  }

  Future<void> _showCredentialDialog(
    BuildContext context,
    WidgetRef ref,
    FileSourceType type, [
    FileSourceCredential? credential,
  ]) async {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(text: credential?.name ?? '');
    final hostController = TextEditingController(text: credential?.host ?? '');
    final portController = TextEditingController(
      text: (credential?.port ?? _defaultPort(type)).toString(),
    );
    final usernameController = TextEditingController(
      text: credential?.username ?? '',
    );
    final passwordController = TextEditingController(
      text: credential?.password ?? '',
    );
    final baseUrlController = TextEditingController(
      text: credential?.baseUrl ?? '',
    );
    final rootPathController = TextEditingController(
      text: credential?.rootPath ?? '/',
    );

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          credential == null
              ? 'file_source_credential_add'.tr()
              : 'file_source_credential_edit'.tr(),
        ),
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
                    decoration: InputDecoration(
                      labelText: 'file_source_credential_name_label'.tr(),
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'file_source_credential_name_hint'.tr()
                        : null,
                  ),
                  TextFormField(
                    controller: rootPathController,
                    decoration: const InputDecoration(labelText: 'Root path'),
                  ),
                  if (type == FileSourceType.webdav)
                    TextFormField(
                      controller: baseUrlController,
                      decoration: const InputDecoration(labelText: 'Base URL'),
                    ),
                  if (type == FileSourceType.sftp ||
                      type == FileSourceType.ftp) ...[
                    TextFormField(
                      controller: hostController,
                      decoration: InputDecoration(
                        labelText: 'file_source_credential_host_label'.tr(),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'file_source_credential_host_hint'.tr()
                          : null,
                    ),
                    TextFormField(
                      controller: portController,
                      decoration: InputDecoration(
                        labelText: 'file_source_credential_port_label'.tr(),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) return null;
                        final port = int.tryParse(value);
                        if (port == null || port <= 0 || port > 65535) {
                          return 'terminal_port_invalid'.tr();
                        }
                        return null;
                      },
                    ),
                  ],
                  TextFormField(
                    controller: usernameController,
                    decoration: InputDecoration(
                      labelText: 'file_source_credential_username_label'.tr(),
                    ),
                  ),
                  TextFormField(
                    controller: passwordController,
                    decoration: InputDecoration(
                      labelText: 'terminal_password'.tr(),
                    ),
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
              final notifier = ref.read(fileSourceCredentialsProvider.notifier);
              final baseUrl = type == FileSourceType.webdav
                  ? normalizeWebDavBaseUrl(baseUrlController.text)
                  : baseUrlController.text.trim();
              if (credential == null) {
                notifier.add(
                  name: nameController.text.trim(),
                  type: type,
                  host: hostController.text.trim(),
                  port: int.tryParse(portController.text.trim()) ?? 0,
                  username: usernameController.text.trim(),
                  password: passwordController.text,
                  baseUrl: baseUrl,
                  rootPath: rootPathController.text.trim().isEmpty
                      ? '/'
                      : rootPathController.text.trim(),
                );
              } else {
                notifier.update(
                  credential.copyWith(
                    name: nameController.text.trim(),
                    host: hostController.text.trim(),
                    port: int.tryParse(portController.text.trim()) ?? 0,
                    username: usernameController.text.trim(),
                    password: passwordController.text,
                    baseUrl: baseUrl,
                    rootPath: rootPathController.text.trim().isEmpty
                        ? '/'
                        : rootPathController.text.trim(),
                  ),
                );
              }
              Navigator.of(context).pop();
            },
            child: Text('save'.tr()),
          ),
        ],
      ),
    );

    nameController.dispose();
    hostController.dispose();
    portController.dispose();
    usernameController.dispose();
    passwordController.dispose();
    baseUrlController.dispose();
    rootPathController.dispose();
  }

  int _defaultPort(FileSourceType type) {
    return switch (type) {
      FileSourceType.sftp => 22,
      FileSourceType.ftp => 21,
      FileSourceType.storage => 0,
      FileSourceType.webdav => 0,
    };
  }
}
