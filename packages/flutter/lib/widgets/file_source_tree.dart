import 'dart:io';

import 'package:animated_tree_view/animated_tree_view.dart';
import 'package:flutter/material.dart';

import '../models/file_source_config.dart';
import '../services/file_sources/file_source.dart';
import '../services/file_sources/file_source_factory.dart';
import '../services/file_sources/path_utils.dart';

class FileSourceTree extends StatefulWidget {
  final FileSourceConfig config;

  const FileSourceTree({super.key, required this.config});

  @override
  State<FileSourceTree> createState() => _FileSourceTreeState();
}

class _FileNodeData {
  final String name;
  final String path;
  final bool isDirectory;
  final int? size;
  final DateTime? modifiedAt;
  final bool loaded;

  const _FileNodeData({
    required this.name,
    required this.path,
    required this.isDirectory,
    this.size,
    this.modifiedAt,
    this.loaded = false,
  });

  _FileNodeData copyWith({bool? loaded}) {
    return _FileNodeData(
      name: name,
      path: path,
      isDirectory: isDirectory,
      size: size,
      modifiedAt: modifiedAt,
      loaded: loaded ?? this.loaded,
    );
  }
}

class _FileSourceTreeState extends State<FileSourceTree> {
  late final FileSource _source;
  late TreeNode<_FileNodeData> _tree;
  TreeViewController<_FileNodeData, TreeNode<_FileNodeData>>? _controller;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _source = createFileSource(widget.config);
    _tree = TreeNode<_FileNodeData>.root(
      data: _FileNodeData(
        name: widget.config.label,
        path: widget.config.rootPath,
        isDirectory: true,
      ),
    );
    _init();
  }

  @override
  void dispose() {
    _source.disconnect();
    super.dispose();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _source.connect();
      await _loadChildren(_tree);
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildToolbar(context),
        const Divider(height: 1),
        Expanded(child: _buildBody(context)),
      ],
    );
  }

  Widget _buildToolbar(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      height: 44,
      child: Row(
        children: [
          const SizedBox(width: 12),
          Icon(_sourceIcon(), size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              widget.config.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleSmall,
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh, size: 18),
            onPressed: _init,
          ),
          IconButton(
            tooltip: 'New File',
            icon: const Icon(Icons.note_add_outlined, size: 18),
            onPressed: () => _create(isDirectory: false),
          ),
          IconButton(
            tooltip: 'New Folder',
            icon: const Icon(Icons.create_new_folder_outlined, size: 18),
            onPressed: () => _create(isDirectory: true),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final theme = Theme.of(context);
    if (_loading) {
      return Container(
        color: theme.colorScheme.surface,
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      final theme = Theme.of(context);
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: theme.colorScheme.error),
              ),
              const SizedBox(height: 12),
              FilledButton(onPressed: _init, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface,
      child: TreeView.simpleTyped<_FileNodeData, TreeNode<_FileNodeData>>(
      tree: _tree,
      showRootNode: true,
      indentation: const Indentation(width: 18),
      onTreeReady: (controller) => _controller = controller,
      onItemTap: _handleTap,
      builder: (context, node) {
        final data = node.data;
        if (data == null) return const SizedBox.shrink();
        final theme = Theme.of(context);
        return GestureDetector(
          onLongPressStart: (details) =>
              _showNodeMenu(node, details.globalPosition),
          child: ListTile(
            dense: true,
            minLeadingWidth: 18,
            leading: Icon(
              data.isDirectory
                  ? Icons.folder_outlined
                  : Icons.insert_drive_file_outlined,
              size: 18,
              color: data.isDirectory
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurfaceVariant,
            ),
            title: Text(
              data.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: theme.colorScheme.onSurface),
            ),
            subtitle: Text(
              _subtitle(data),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        );
      },
      ),
    );
  }

  Future<void> _handleTap(TreeNode<_FileNodeData> node) async {
    final data = node.data;
    if (data == null || !data.isDirectory) return;
    if (!data.loaded) {
      await _loadChildren(node);
    }
    _controller?.toggleExpansion(node);
  }

  Future<void> _loadChildren(TreeNode<_FileNodeData> node) async {
    final data = node.data;
    if (data == null || !data.isDirectory) return;
    final entries = await _source.list(data.path);
    node.clear();
    node.addAll(entries.map(_toNode));
    node.data = data.copyWith(loaded: true);
    if (mounted) setState(() => _tree = _cloneRoot());
  }

  TreeNode<_FileNodeData> _toNode(FileSourceEntry entry) {
    return TreeNode<_FileNodeData>(
      key: entry.path,
      data: _FileNodeData(
        name: entry.name,
        path: entry.path,
        isDirectory: entry.isDirectory,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      ),
    );
  }

  Future<void> _create({required bool isDirectory}) async {
    final name = await _prompt('Name');
    if (name == null || name.trim().isEmpty) return;
    final root = _tree.data;
    if (root == null) return;
    final path = _join(root.path, name.trim());
    await _runAction(() async {
      if (isDirectory) {
        await _source.createFolder(path);
      } else {
        await _source.createFile(path);
      }
      await _loadChildren(_tree);
    });
  }

  Future<void> _showNodeMenu(
    TreeNode<_FileNodeData> node,
    Offset position,
  ) async {
    final data = node.data;
    if (data == null || node.isRoot) return;
    final action = await showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy,
        position.dx,
        position.dy,
      ),
      items: const [
        PopupMenuItem(value: 'rename', child: Text('Rename')),
        PopupMenuItem(value: 'copy', child: Text('Copy')),
        PopupMenuItem(value: 'move', child: Text('Move')),
        PopupMenuItem(value: 'download', child: Text('Download')),
        PopupMenuItem(value: 'delete', child: Text('Delete')),
        PopupMenuItem(value: 'info', child: Text('Info')),
      ],
    );
    if (action == null) return;
    await _handleAction(action, node, data);
  }

  Future<void> _handleAction(
    String action,
    TreeNode<_FileNodeData> node,
    _FileNodeData data,
  ) async {
    switch (action) {
      case 'rename':
        final name = await _prompt('New name', initialValue: data.name);
        if (name == null || name.trim().isEmpty) return;
        await _runAction(() async {
          await _source.rename(
            data.path,
            _join(dirnameOf(data.path), name.trim()),
          );
          await _reloadParent(node);
        });
      case 'copy':
        final target = await _prompt('Copy to path', initialValue: data.path);
        if (target == null || target.trim().isEmpty) return;
        await _runAction(() async {
          await _source.copy(data.path, target.trim());
          await _reloadParent(node);
        });
      case 'move':
        final target = await _prompt('Move to path', initialValue: data.path);
        if (target == null || target.trim().isEmpty) return;
        await _runAction(() async {
          await _source.move(data.path, target.trim());
          await _reloadParent(node);
        });
      case 'download':
        final target = await _prompt(
          'Local file path',
          initialValue: _defaultDownloadPath(data.name),
        );
        if (target == null || target.trim().isEmpty) return;
        await _runAction(
          () => _source.download(data.path, File(target.trim())),
        );
      case 'delete':
        final confirmed = await _confirm('Delete ${data.name}?');
        if (!confirmed) return;
        await _runAction(() async {
          await _source.delete(data.path, isDirectory: data.isDirectory);
          await _reloadParent(node);
        });
      case 'info':
        await _showInfo(data);
    }
  }

  Future<void> _reloadParent(TreeNode<_FileNodeData> node) async {
    final parent = node.parent;
    if (parent is TreeNode<_FileNodeData>) {
      await _loadChildren(parent);
    } else {
      await _loadChildren(_tree);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<String?> _prompt(String title, {String initialValue = ''}) async {
    final controller = TextEditingController(text: initialValue);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<bool> _confirm(String title) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(title),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _showInfo(_FileNodeData data) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(data.name),
        content: SelectableText(
          'Path: ${data.path}\n'
          'Type: ${data.isDirectory ? 'Folder' : 'File'}\n'
          'Size: ${data.size ?? '-'}\n'
          'Modified: ${data.modifiedAt ?? '-'}',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  TreeNode<_FileNodeData> _cloneRoot() {
    final root = TreeNode<_FileNodeData>.root(data: _tree.data);
    root.addAll(_tree.childrenAsList.cast<TreeNode<_FileNodeData>>());
    return root;
  }

  IconData _sourceIcon() {
    return switch (widget.config.type) {
      FileSourceType.sftp => Icons.security,
      FileSourceType.ftp => Icons.cloud_queue,
      FileSourceType.storage => Icons.storage,
      FileSourceType.webdav => Icons.cloud_sync_outlined,
    };
  }

  String _join(String parent, String name) {
    return widget.config.type == FileSourceType.storage
        ? joinLocalPath(parent, name)
        : joinRemotePath(parent, name);
  }

  String _defaultDownloadPath(String name) =>
      joinLocalPath(Directory.systemTemp.path, name);

  String _subtitle(_FileNodeData data) {
    if (data.isDirectory) return data.path;
    final size = data.size == null ? '-' : '${data.size} B';
    return '$size  ${data.path}';
  }
}
