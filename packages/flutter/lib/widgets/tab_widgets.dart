import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../models/file_source_config.dart';
import '../models/file_source_credential.dart';
import '../providers/browser_provider.dart';
import '../providers/file_source_credentials_provider.dart';
import '../services/file_sources/file_source_factory.dart';
import '../services/webview_service.dart';

class NavButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const NavButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon, size: 14),
      tooltip: tooltip,
      color: theme.colorScheme.onSurfaceVariant,
      style: IconButton.styleFrom(
        minimumSize: const Size(32, 32),
        padding: const EdgeInsets.symmetric(horizontal: 6),
      ),
    );
  }
}

List<PopupMenuEntry<VoidCallback>> buildBrowserMenuItems(
  BuildContext context,
  WidgetRef ref, {
  required String? activeTabId,
  VoidCallback? onNewTab,
  VoidCallback? onNewTerminal,
  void Function(FileSourceConfig config)? onNewFileSource,
}) {
  void runWithActiveTab(void Function(String tabId) action) {
    final tabId = activeTabId;
    if (tabId != null && tabId.isNotEmpty) {
      action(tabId);
    }
  }

  return [
    if (onNewTab != null)
      PopupMenuItem<VoidCallback>(
        value: onNewTab,
        child: Text('tab_new_tab'.tr()),
      ),
    if (onNewTerminal != null)
      PopupMenuItem<VoidCallback>(
        value: onNewTerminal,
        child: Text('tab_new_terminal'.tr()),
      ),
    if (onNewFileSource != null) ...[
      PopupMenuItem<VoidCallback>(
        value: () => _showFileSourceDialog(
          context,
          FileSourceType.sftp,
          onNewFileSource,
        ),
        child: const Text('New SFTP Tab'),
      ),
      PopupMenuItem<VoidCallback>(
        value: () =>
            _showFileSourceDialog(context, FileSourceType.ftp, onNewFileSource),
        child: const Text('New FTP Tab'),
      ),
      PopupMenuItem<VoidCallback>(
        value: () => _showFileSourceDialog(
          context,
          FileSourceType.storage,
          onNewFileSource,
        ),
        child: const Text('New Storage Tab'),
      ),
      PopupMenuItem<VoidCallback>(
        value: () => _showFileSourceDialog(
          context,
          FileSourceType.webdav,
          onNewFileSource,
        ),
        child: const Text('New WebDAV Tab'),
      ),
    ],
    PopupMenuItem<VoidCallback>(
      value: () => runWithActiveTab(WebViewService.instance.goBack),
      child: Text('tab_go_back'.tr()),
    ),
    PopupMenuItem<VoidCallback>(
      value: () => runWithActiveTab(WebViewService.instance.goForward),
      child: Text('tab_go_forward'.tr()),
    ),
    PopupMenuItem<VoidCallback>(
      value: () => runWithActiveTab(WebViewService.instance.reload),
      child: Text('tab_refresh'.tr()),
    ),
    PopupMenuItem<VoidCallback>(
      value: () => showSplitMenu(context, ref),
      child: Text('tab_split_layout'.tr()),
    ),
    PopupMenuItem<VoidCallback>(
      value: () => context.push('/bookmarks'),
      child: Text('bookmarks'.tr()),
    ),
    PopupMenuItem<VoidCallback>(
      value: () => context.push('/settings'),
      child: Text('settings'.tr()),
    ),
  ];
}

Future<void> _showFileSourceDialog(
  BuildContext context,
  FileSourceType type,
  void Function(FileSourceConfig config) onCreate,
) async {
  final labelController = TextEditingController(text: _fileSourceLabel(type));
  final rootController = TextEditingController(text: '/');
  final hostController = TextEditingController();
  final portController = TextEditingController(text: _defaultPort(type));
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();
  final baseUrlController = TextEditingController();

  final config = await showDialog<FileSourceConfig>(
    context: context,
    builder: (context) => _FileSourceDialog(
      type: type,
      labelController: labelController,
      rootController: rootController,
      hostController: hostController,
      portController: portController,
      usernameController: usernameController,
      passwordController: passwordController,
      baseUrlController: baseUrlController,
    ),
  );

  if (config != null) onCreate(config);
}

class _FileSourceDialog extends ConsumerStatefulWidget {
  final FileSourceType type;
  final TextEditingController labelController;
  final TextEditingController rootController;
  final TextEditingController hostController;
  final TextEditingController portController;
  final TextEditingController usernameController;
  final TextEditingController passwordController;
  final TextEditingController baseUrlController;

  const _FileSourceDialog({
    required this.type,
    required this.labelController,
    required this.rootController,
    required this.hostController,
    required this.portController,
    required this.usernameController,
    required this.passwordController,
    required this.baseUrlController,
  });

  @override
  ConsumerState<_FileSourceDialog> createState() => _FileSourceDialogState();
}

class _FileSourceDialogState extends ConsumerState<_FileSourceDialog> {
  String? _selectedCredentialId;
  bool _saveCredential = false;
  bool _testing = false;
  String? _testResult; // null=未测试, 成功消息, 错误消息

  FileSourceConfig get _currentConfig => FileSourceConfig(
    type: widget.type,
    label: widget.labelController.text.trim().isEmpty
        ? _fileSourceLabel(widget.type)
        : widget.labelController.text.trim(),
    rootPath: widget.rootController.text.trim().isEmpty
        ? '/'
        : widget.rootController.text.trim(),
    host: widget.hostController.text.trim(),
    port: int.tryParse(widget.portController.text.trim()) ?? 0,
    username: widget.usernameController.text.trim(),
    password: widget.passwordController.text,
    baseUrl: widget.baseUrlController.text.trim(),
  );

  @override
  Widget build(BuildContext context) {
    final credentials = ref
        .watch(fileSourceCredentialsProvider)
        .where((c) => c.type == widget.type)
        .toList();
    final canTest = widget.type != FileSourceType.storage;

    return AlertDialog(
      title: Text('New ${_fileSourceLabel(widget.type)} Tab'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (credentials.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  initialValue: _selectedCredentialId,
                  decoration: InputDecoration(
                    labelText: 'file_source_select_credential'.tr(),
                    border: const OutlineInputBorder(),
                  ),
                  items: credentials
                      .map(
                        (c) => DropdownMenuItem(
                          value: c.id,
                          child: Text(
                            '${c.name} (${c.summary})',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (id) {
                    final credential = credentials.firstWhere(
                      (c) => c.id == id,
                    );
                    setState(() {
                      _selectedCredentialId = id;
                      _testResult = null;
                    });
                    _applyCredential(credential);
                  },
                ),
                const SizedBox(height: 14),
              ],
              TextField(
                controller: widget.labelController,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: widget.rootController,
                decoration: const InputDecoration(labelText: 'Root path'),
              ),
              if (widget.type == FileSourceType.webdav)
                TextField(
                  controller: widget.baseUrlController,
                  decoration: const InputDecoration(labelText: 'Base URL'),
                ),
              if (widget.type == FileSourceType.sftp ||
                  widget.type == FileSourceType.ftp) ...[
                TextField(
                  controller: widget.hostController,
                  decoration: const InputDecoration(labelText: 'Host'),
                ),
                TextField(
                  controller: widget.portController,
                  decoration: const InputDecoration(labelText: 'Port'),
                  keyboardType: TextInputType.number,
                ),
              ],
              if (widget.type != FileSourceType.storage) ...[
                TextField(
                  controller: widget.usernameController,
                  decoration: const InputDecoration(labelText: 'Username'),
                ),
                TextField(
                  controller: widget.passwordController,
                  decoration: const InputDecoration(labelText: 'Password'),
                  obscureText: true,
                ),
              ],
              if (canTest) ...[
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('file_source_save_credential'.tr()),
                  subtitle: Text('file_source_save_credential_desc'.tr()),
                  value: _saveCredential,
                  onChanged: (v) => setState(() => _saveCredential = v),
                ),
                const SizedBox(height: 4),
                if (_testResult != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _testResult!.startsWith('✓')
                          ? Colors.green.withValues(alpha: 0.1)
                          : Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _testResult!,
                      style: TextStyle(
                        fontSize: 12,
                        color: _testResult!.startsWith('✓')
                            ? Colors.green
                            : Colors.red,
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        if (canTest)
          TextButton.icon(
            onPressed: _testing ? null : _testConnection,
            icon: _testing
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.wifi_tethering, size: 16),
            label: Text('file_source_test_connection'.tr()),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text('cancel'.tr()),
        ),
        FilledButton(
          onPressed: () {
            if (_saveCredential) _saveCurrentCredential();
            Navigator.of(context).pop(_currentConfig);
          },
          child: Text('ok'.tr()),
        ),
      ],
    );
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _testResult = null;
    });
    try {
      final source = createFileSource(_currentConfig);
      await source.connect();
      await source.disconnect();
      if (!mounted) return;
      setState(() {
        _testing = false;
        _testResult = '✓ ${'file_source_test_success'.tr()}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _testing = false;
        _testResult = '✗ $e';
      });
    }
  }

  void _saveCurrentCredential() {
    final config = _currentConfig;
    ref.read(fileSourceCredentialsProvider.notifier).add(
      name: config.label,
      type: config.type,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      baseUrl: config.baseUrl,
      rootPath: config.rootPath,
    );
  }

  void _applyCredential(FileSourceCredential credential) {
    widget.labelController.text = credential.name;
    widget.rootController.text = credential.rootPath;
    widget.hostController.text = credential.host;
    widget.portController.text = credential.port > 0
        ? credential.port.toString()
        : _defaultPort(widget.type);
    widget.usernameController.text = credential.username;
    widget.passwordController.text = credential.password;
    widget.baseUrlController.text = credential.baseUrl;
  }
}

String _fileSourceLabel(FileSourceType type) {
  return switch (type) {
    FileSourceType.sftp => 'SFTP',
    FileSourceType.ftp => 'FTP',
    FileSourceType.storage => 'Storage',
    FileSourceType.webdav => 'WebDAV',
  };
}

String _defaultPort(FileSourceType type) {
  return switch (type) {
    FileSourceType.sftp => '22',
    FileSourceType.ftp => '21',
    FileSourceType.storage => '',
    FileSourceType.webdav => '',
  };
}

class FaviconIcon extends StatelessWidget {
  final String url;
  const FaviconIcon({super.key, required this.url});

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return Icon(
        Icons.language,
        size: 14,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: Image.network(
        url,
        width: 14,
        height: 14,
        // ignore: avoid_renaming_method_parameters
        errorBuilder: (context, error, stackTrace) => Icon(
          Icons.language,
          size: 14,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

void showSplitMenu(BuildContext context, WidgetRef ref) {
  final current = ref.read(browserProvider).splitLayout;
  final notifier = ref.read(browserProvider.notifier);
  showDialog(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: Text(
        'tab_split_layout'.tr(),
        style: const TextStyle(fontSize: 15),
      ),
      children: [
        _splitOption(
          ctx,
          notifier,
          SplitLayout.single,
          'tab_split_layout_reset'.tr(),
          Icons.crop_square,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.horizontal2,
          'tab_split_horizontal_2'.tr(),
          Icons.view_column,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.vertical2,
          'tab_split_vertical_2'.tr(),
          Icons.view_agenda,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.horizontal3,
          'tab_split_horizontal_3'.tr(),
          Icons.view_carousel,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.quad,
          'tab_split_quad'.tr(),
          Icons.grid_view,
          current,
        ),
      ],
    ),
  );
}

SimpleDialogOption _splitOption(
  BuildContext ctx,
  BrowserNotifier notifier,
  SplitLayout layout,
  String label,
  IconData icon,
  SplitLayout current,
) {
  final selected = layout == current;
  return SimpleDialogOption(
    onPressed: () {
      notifier.setSplitLayout(layout);
      Navigator.of(ctx).pop();
    },
    child: Row(
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        if (selected) ...[
          const Spacer(),
          Icon(Icons.check, size: 16, color: Theme.of(ctx).colorScheme.primary),
        ],
      ],
    ),
  );
}
