import 'dart:convert';
import 'dart:io';

import 'package:animated_tree_view/animated_tree_view.dart';
import 'package:desktop_drop/desktop_drop.dart';
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';

import '../models/file_source_config.dart';
import '../services/notification_service.dart';
import '../services/file_sources/file_source.dart';
import '../services/file_sources/file_source_factory.dart';
import '../services/file_sources/path_utils.dart';

final _notificationService = NotificationService();

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

class _DownloadProgress {
  final int completed;
  final int total;
  final String currentName;
  final bool finished;
  final bool failed;

  const _DownloadProgress({
    required this.completed,
    required this.total,
    required this.currentName,
    this.finished = false,
    this.failed = false,
  });

  double? get value => total == 0 ? null : completed / total;
}

class _UploadProgress {
  final int completed;
  final int total;
  final String currentName;
  final bool finished;
  final bool failed;

  const _UploadProgress({
    required this.completed,
    required this.total,
    required this.currentName,
    this.finished = false,
    this.failed = false,
  });

  double? get value => total == 0 ? null : completed / total;
}

class _DroppedUploadFile {
  final String name;
  final String path;
  final int? size;

  const _DroppedUploadFile({
    required this.name,
    required this.path,
    required this.size,
  });
}

class _FileSourceTreeState extends State<FileSourceTree> {
  late final FileSource _source;
  late TreeNode<_FileNodeData> _tree;
  TreeViewController<_FileNodeData, TreeNode<_FileNodeData>>? _controller;
  Set<String>? _pendingExpandedPaths;
  final Set<String> _selectedPaths = <String>{};
  _DownloadProgress? _downloadProgress;
  _UploadProgress? _uploadProgress;
  Future<void> _uploadQueue = Future<void>.value();
  int _treeVersion = 0;
  bool _loading = true;
  bool _dragging = false;
  bool _multiSelect = false;
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
      _selectedPaths.clear();
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
    final theme = Theme.of(context);
    return DropTarget(
      enable: _dropTargetEnabled(context),
      onDragDone: _handleDragDone,
      onDragEntered: (_) => setState(() => _dragging = true),
      onDragExited: (_) => setState(() => _dragging = false),
      child: Stack(
        children: [
          Column(
            children: [
              _buildToolbar(context),
              const Divider(height: 1),
              Expanded(child: _buildBody(context)),
              if (_downloadProgress != null) ...[
                const Divider(height: 1),
                _buildDownloadProgress(context),
              ],
              if (_uploadProgress != null) ...[
                const Divider(height: 1),
                _buildUploadProgress(context),
              ],
            ],
          ),
          if (_dragging)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.10),
                  border: Border.all(
                    color: theme.colorScheme.primary,
                    width: 2,
                  ),
                ),
                child: Center(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          blurRadius: 16,
                          color: theme.colorScheme.shadow.withValues(
                            alpha: 0.14,
                          ),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 12,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.upload_file_outlined,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          Text(
                            '释放以上传文件',
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildToolbar(BuildContext context) {
    final theme = Theme.of(context);
    final selectedCount = _selectedPaths.length;
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
          if (_multiSelect) ...[
            if (selectedCount > 0)
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Text(
                  '$selectedCount',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
            IconButton(
              tooltip: '取消选择',
              icon: const Icon(Icons.deselect_outlined, size: 18),
              onPressed: selectedCount == 0 ? null : _clearSelection,
            ),
            IconButton(
              tooltip: '反选',
              icon: const Icon(Icons.select_all_outlined, size: 18),
              onPressed: _invertSelection,
            ),
            IconButton(
              tooltip: '下载',
              icon: const Icon(Icons.download_outlined, size: 18),
              onPressed: selectedCount == 0 ? null : _downloadSelected,
            ),
            IconButton(
              tooltip: '删除',
              icon: const Icon(Icons.delete_outline, size: 18),
              onPressed: selectedCount == 0 ? null : _deleteSelected,
            ),
            IconButton(
              tooltip: '移动',
              icon: const Icon(Icons.drive_file_move_outline, size: 18),
              onPressed: selectedCount == 0 ? null : _moveSelected,
            ),
            IconButton(
              tooltip: '退出多选',
              icon: const Icon(Icons.close, size: 18),
              onPressed: _exitMultiSelect,
            ),
          ] else ...[
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh, size: 18),
              onPressed: _init,
            ),
            IconButton(
              tooltip: 'Upload File',
              icon: const Icon(Icons.upload_file_outlined, size: 18),
              onPressed: _uploadFile,
            ),
            IconButton(
              tooltip: 'Multi Select',
              icon: const Icon(Icons.checklist_outlined, size: 18),
              onPressed: _enterMultiSelect,
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
        ],
      ),
    );
  }

  Widget _buildDownloadProgress(BuildContext context) {
    final progress = _downloadProgress;
    if (progress == null) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final status = progress.failed
        ? '下载失败'
        : progress.finished
        ? '下载完成'
        : '下载中';
    final icon = progress.failed
        ? Icons.error_outline
        : progress.finished
        ? Icons.check_circle_outline
        : Icons.downloading_outlined;
    final color = progress.failed ? colorScheme.error : colorScheme.primary;

    return Container(
      color: colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$status ${progress.completed}/${progress.total}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(color: color),
                ),
              ),
              Text(
                '${((progress.value ?? 0) * 100).round()}%',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: progress.value),
          const SizedBox(height: 4),
          Text(
            progress.currentName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadProgress(BuildContext context) {
    final progress = _uploadProgress;
    if (progress == null) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final status = progress.failed
        ? '上传失败'
        : progress.finished
        ? '上传完成'
        : '上传中';
    final icon = progress.failed
        ? Icons.error_outline
        : progress.finished
        ? Icons.check_circle_outline
        : Icons.cloud_upload_outlined;
    final color = progress.failed ? colorScheme.error : colorScheme.primary;

    return Container(
      color: colorScheme.surface,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$status ${progress.completed}/${progress.total}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(color: color),
                ),
              ),
              Text(
                '${((progress.value ?? 0) * 100).round()}%',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: progress.value),
          const SizedBox(height: 4),
          Text(
            progress.currentName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
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
      return Container(
        color: theme.colorScheme.errorContainer,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: theme.colorScheme.onErrorContainer),
                ),
                const SizedBox(height: 12),
                FilledButton(onPressed: _init, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      color: theme.colorScheme.surface,
      child: TreeView.simpleTyped<_FileNodeData, TreeNode<_FileNodeData>>(
        key: ValueKey(_treeVersion),
        tree: _tree,
        showRootNode: true,
        indentation: const Indentation(width: 18),
        onTreeReady: (controller) {
          _controller = controller;
          _restorePendingExpansion();
        },
        builder: (context, node) {
          final data = node.data;
          if (data == null) return const SizedBox.shrink();
          final theme = Theme.of(context);
          final selected = _selectedPaths.contains(data.path);
          return Builder(
            builder: (tileContext) => GestureDetector(
              onLongPressStart: (details) {
                if (_multiSelect) {
                  _toggleSelection(data);
                  return;
                }
                _showNodeMenu(node, details.globalPosition);
              },
              child: ListTile(
                dense: true,
                selected: selected,
                minLeadingWidth: 18,
                onTap: () => _handleTap(tileContext, node),
                leading: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_multiSelect && !node.isRoot) ...[
                      Checkbox(
                        value: selected,
                        visualDensity: VisualDensity.compact,
                        onChanged: (_) => _toggleSelection(data),
                      ),
                      const SizedBox(width: 4),
                    ],
                    Icon(
                      data.isDirectory
                          ? Icons.folder_outlined
                          : Icons.insert_drive_file_outlined,
                      size: 18,
                      color: data.isDirectory
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  ],
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
            ),
          );
        },
      ),
    );
  }

  Future<void> _handleTap(
    BuildContext tileContext,
    TreeNode<_FileNodeData> node,
  ) async {
    final data = node.data;
    if (data == null) return;
    if (_multiSelect) {
      _toggleSelection(data);
      return;
    }
    if (!node.isRoot) {
      final menuPosition = _menuPositionFor(tileContext);
      if (data.isDirectory && !data.loaded) {
        final loaded = await _loadAndExpandDirectory(node);
        if (!loaded) return;
      }
      await _showNodeMenu(node, menuPosition);
      return;
    }
    if (!data.isDirectory) return;
    await _loadAndExpandDirectory(node);
  }

  Future<bool> _loadAndExpandDirectory(TreeNode<_FileNodeData> node) async {
    final data = node.data;
    if (data == null || !data.isDirectory) return false;
    if (!data.loaded) {
      try {
        await _loadChildren(node, rebuildTree: false);
      } catch (error) {
        if (!mounted) return false;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
        return false;
      }
      if (node.childrenAsList.isNotEmpty) {
        _controller?.expandNode(node);
      }
    }
    return true;
  }

  Offset _menuPositionFor(BuildContext tileContext) {
    final box = tileContext.findRenderObject() as RenderBox?;
    if (box == null) return Offset.zero;
    return box.localToGlobal(Offset(40, box.size.height / 2));
  }

  Future<void> _loadChildren(
    TreeNode<_FileNodeData> node, {
    bool rebuildTree = true,
  }) async {
    final data = node.data;
    if (data == null || !data.isDirectory) return;
    final entries = await _source.list(data.path);
    node.clear();
    node.addAll(entries.map(_toNode));
    node.data = data.copyWith(loaded: true);
    if (mounted && rebuildTree) setState(() => _treeVersion++);
  }

  TreeNode<_FileNodeData> _toNode(FileSourceEntry entry) {
    return TreeNode<_FileNodeData>(
      key: base64Url.encode(utf8.encode(entry.path)),
      data: _FileNodeData(
        name: entry.name,
        path: entry.path,
        isDirectory: entry.isDirectory,
        size: entry.size,
        modifiedAt: entry.modifiedAt,
      ),
    );
  }

  Future<void> _uploadFile() async {
    final localFile = await openFile();
    if (localFile == null) return;
    final root = _tree.data;
    if (root == null) return;
    final targetPath = _join(root.path, localBasename(localFile.path));
    await _runAction(() async {
      await _source.upload(File(localFile.path), targetPath);
      await _reloadPreservingExpansion(_tree);
    });
  }

  Future<void> _handleDragDone(DropDoneDetails detail) async {
    if (!_isDropInsideThisTree(detail.globalPosition)) return;
    if (mounted) setState(() => _dragging = false);
    final files = <_DroppedUploadFile>[];
    for (final file in detail.files) {
      final localFile = File(file.path);
      if (!await localFile.exists()) continue;
      files.add(
        _DroppedUploadFile(
          name: localBasename(file.path),
          path: file.path,
          size: await localFile.length(),
        ),
      );
    }
    if (files.isEmpty) {
      _showMessage('未接收到可上传的文件。');
      return;
    }
    final targetDirectory = await _showDroppedFilesDialog(files);
    if (targetDirectory == null || targetDirectory.trim().isEmpty) return;
    _enqueueUploads(files, targetDirectory);
  }

  bool _dropTargetEnabled(BuildContext context) {
    var enabled = true;
    context.visitAncestorElements((element) {
      final widget = element.widget;
      if (widget is Offstage && widget.offstage) {
        enabled = false;
        return false;
      }
      return true;
    });
    return enabled;
  }

  bool _isDropInsideThisTree(Offset globalPosition) {
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.hasSize) return false;
    final localPosition = renderBox.globalToLocal(globalPosition);
    return renderBox.paintBounds.contains(localPosition);
  }

  Future<String?> _showDroppedFilesDialog(
    List<_DroppedUploadFile> files,
  ) async {
    String? selectedDirectory;
    final rootPath = _tree.data?.path ?? widget.config.rootPath;
    return showDialog<String>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('上传文件'),
              content: SizedBox(
                width: 560,
                height: 420,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '已接收 ${files.length} 个文件',
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: ListView.separated(
                        itemCount: files.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final file = files[index];
                          return ListTile(
                            dense: true,
                            leading: const Icon(
                              Icons.insert_drive_file_outlined,
                              size: 18,
                            ),
                            title: Text(
                              file.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              '${_formatSize(file.size)}  ${file.path}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            selectedDirectory ?? rootPath,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final directory =
                                await _showRemoteDirectoryPickerDialog();
                            if (directory == null) return;
                            setDialogState(() {
                              selectedDirectory = directory;
                            });
                          },
                          icon: const Icon(
                            Icons.folder_open_outlined,
                            size: 18,
                          ),
                          label: const Text('选择保存路径'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
                FilledButton(
                  onPressed: () =>
                      Navigator.of(context).pop(selectedDirectory ?? rootPath),
                  child: const Text('开始上传'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<String?> _showRemoteDirectoryPickerDialog() async {
    final rootData = _tree.data;
    if (rootData == null) return null;
    final pickerRoot = TreeNode<_FileNodeData>.root(data: rootData);
    TreeViewController<_FileNodeData, TreeNode<_FileNodeData>>?
    pickerController;
    String? selectedPath = rootData.path;
    var loading = true;
    var treeVersion = 0;
    String? error;

    Future<void> loadDirectories(TreeNode<_FileNodeData> node) async {
      final data = node.data;
      if (data == null || !data.isDirectory) return;
      final entries = await _source.list(data.path);
      node.clear();
      node.addAll(
        entries
            .where((entry) => entry.isDirectory)
            .map(
              (entry) => TreeNode<_FileNodeData>(
                key: base64Url.encode(utf8.encode(entry.path)),
                data: _FileNodeData(
                  name: entry.name,
                  path: entry.path,
                  isDirectory: entry.isDirectory,
                  size: entry.size,
                  modifiedAt: entry.modifiedAt,
                ),
              ),
            ),
      );
      node.data = data.copyWith(loaded: true);
    }

    return showDialog<String>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            if (loading) {
              loading = false;
              loadDirectories(pickerRoot)
                  .then((_) {
                    if (!context.mounted) return;
                    setDialogState(() => treeVersion++);
                  })
                  .catchError((Object loadError) {
                    if (!context.mounted) return;
                    setDialogState(() => error = loadError.toString());
                  });
            }

            return AlertDialog(
              title: const Text('选择保存路径'),
              content: SizedBox(
                width: 560,
                height: 420,
                child: error != null
                    ? Center(child: Text(error!))
                    : TreeView.simpleTyped<
                        _FileNodeData,
                        TreeNode<_FileNodeData>
                      >(
                        key: ValueKey('directory-picker-$treeVersion'),
                        tree: pickerRoot,
                        showRootNode: true,
                        indentation: const Indentation(width: 18),
                        onTreeReady: (controller) {
                          pickerController = controller;
                        },
                        builder: (context, node) {
                          final data = node.data;
                          if (data == null) return const SizedBox.shrink();
                          final selected = selectedPath == data.path;
                          return ListTile(
                            dense: true,
                            selected: selected,
                            minLeadingWidth: 18,
                            leading: Icon(
                              Icons.folder_outlined,
                              size: 18,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            title: Text(
                              data.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              data.path,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            onTap: () async {
                              setDialogState(() {
                                selectedPath = data.path;
                              });
                              if (data.loaded) {
                                pickerController?.expandNode(node);
                                return;
                              }
                              try {
                                await loadDirectories(node);
                                if (!context.mounted) return;
                                setDialogState(() => treeVersion++);
                                WidgetsBinding.instance.addPostFrameCallback((
                                  _,
                                ) {
                                  pickerController?.expandNode(node);
                                });
                              } catch (loadError) {
                                if (!context.mounted) return;
                                setDialogState(
                                  () => error = loadError.toString(),
                                );
                              }
                            },
                          );
                        },
                      ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
                FilledButton(
                  onPressed: selectedPath == null
                      ? null
                      : () => Navigator.of(context).pop(selectedPath),
                  child: const Text('完成选择'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _enqueueUploads(List<_DroppedUploadFile> files, String targetDirectory) {
    _uploadQueue = _uploadQueue.then((_) async {
      await _uploadFiles(files, targetDirectory);
    });
  }

  Future<void> _uploadFiles(
    List<_DroppedUploadFile> files,
    String targetDirectory,
  ) async {
    var completed = 0;
    _setUploadProgress(
      completed: completed,
      total: files.length,
      currentName: files.first.name,
    );

    try {
      for (final file in files) {
        _setUploadProgress(
          completed: completed,
          total: files.length,
          currentName: file.name,
        );
        await _source.upload(
          File(file.path),
          _join(targetDirectory, file.name),
        );
        completed++;
        _setUploadProgress(
          completed: completed,
          total: files.length,
          currentName: file.name,
        );
      }
      await _reloadPreservingExpansion(_tree);
      _setUploadProgress(
        completed: completed,
        total: files.length,
        currentName: files.last.name,
        finished: true,
      );
      await _notifyUploadFinished(files.length, failed: false);
    } catch (error) {
      _setUploadProgress(
        completed: completed,
        total: files.length,
        currentName: files[completed.clamp(0, files.length - 1)].name,
        failed: true,
      );
      _showMessage(error.toString());
      await _notifyUploadFinished(files.length, failed: true);
    }
  }

  void _setUploadProgress({
    required int completed,
    required int total,
    required String currentName,
    bool finished = false,
    bool failed = false,
  }) {
    if (!mounted) return;
    setState(() {
      _uploadProgress = _UploadProgress(
        completed: completed,
        total: total,
        currentName: currentName,
        finished: finished,
        failed: failed,
      );
    });
  }

  Future<void> _notifyUploadFinished(int count, {required bool failed}) async {
    try {
      await _notificationService.showNotification(
        title: failed ? '文件上传失败' : '文件上传完成',
        body: failed ? '$count 个文件上传任务未完成。' : '已上传 $count 个文件。',
      );
    } catch (_) {
      if (mounted) {
        _showMessage(failed ? '文件上传失败。' : '文件上传完成。');
      }
    }
  }

  void _enterMultiSelect() {
    setState(() => _multiSelect = true);
  }

  void _exitMultiSelect() {
    setState(() {
      _multiSelect = false;
      _selectedPaths.clear();
    });
  }

  void _clearSelection() {
    setState(_selectedPaths.clear);
  }

  void _invertSelection() {
    final selectablePaths = _selectablePaths();
    setState(() {
      final nextSelection = selectablePaths.difference(_selectedPaths);
      _selectedPaths
        ..clear()
        ..addAll(nextSelection);
    });
  }

  void _toggleSelection(_FileNodeData data) {
    if (data.path == _tree.data?.path) return;
    setState(() {
      if (!_selectedPaths.add(data.path)) {
        _selectedPaths.remove(data.path);
      }
    });
  }

  Set<String> _selectablePaths() {
    final paths = <String>{};
    _visitNodes(_tree, (node) {
      final data = node.data;
      if (data != null && !node.isRoot) paths.add(data.path);
    });
    return paths;
  }

  List<(TreeNode<_FileNodeData>, _FileNodeData)> _selectedEntries() {
    final entries = <(TreeNode<_FileNodeData>, _FileNodeData)>[];
    _visitNodes(_tree, (node) {
      final data = node.data;
      if (data != null && !node.isRoot && _selectedPaths.contains(data.path)) {
        entries.add((node, data));
      }
    });
    return entries;
  }

  Future<void> _downloadSelected() async {
    final entries = _selectedEntries();
    final files = entries.where((entry) => !entry.$2.isDirectory).toList();
    if (files.isEmpty) {
      _showMessage('No files selected to download.');
      return;
    }
    final targetDirectory = await getDirectoryPath();
    if (targetDirectory == null || targetDirectory.trim().isEmpty) return;
    await _runAction(() async {
      await _downloadFiles(
        files
            .map(
              (entry) => (
                data: entry.$2,
                target: File(joinLocalPath(targetDirectory, entry.$2.name)),
              ),
            )
            .toList(),
      );
    });
    final skipped = entries.length - files.length;
    if (skipped > 0) {
      _showMessage(
        'Downloaded ${files.length} file(s), skipped $skipped folder(s).',
      );
    }
  }

  Future<void> _deleteSelected() async {
    final entries = _selectedEntries()
      ..sort((a, b) => b.$2.path.length.compareTo(a.$2.path.length));
    if (entries.isEmpty) return;
    final confirmed = await _confirm(
      'Delete ${entries.length} selected item(s)?',
    );
    if (!confirmed) return;
    await _runAction(() async {
      for (final entry in entries) {
        final data = entry.$2;
        await _source.delete(data.path, isDirectory: data.isDirectory);
      }
      _selectedPaths.clear();
      await _reloadPreservingExpansion(_tree);
    });
  }

  Future<void> _moveSelected() async {
    final entries = _selectedEntries()
      ..sort((a, b) => b.$2.path.length.compareTo(a.$2.path.length));
    if (entries.isEmpty) return;
    final targetDirectory = await _prompt('Move to folder path');
    if (targetDirectory == null || targetDirectory.trim().isEmpty) return;
    await _runAction(() async {
      for (final entry in entries) {
        final data = entry.$2;
        await _source.move(data.path, _join(targetDirectory.trim(), data.name));
      }
      _selectedPaths.clear();
      await _reloadPreservingExpansion(_tree);
    });
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
      await _reloadPreservingExpansion(_tree);
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
          () => _downloadFiles([(data: data, target: File(target.trim()))]),
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
      await _reloadPreservingExpansion(parent);
    } else {
      await _reloadPreservingExpansion(_tree);
    }
  }

  Future<void> _reloadPreservingExpansion(TreeNode<_FileNodeData> node) async {
    final expandedPaths = _expandedPaths();
    await _loadChildren(node, rebuildTree: false);
    await _reloadExpandedChildren(node, expandedPaths);
    if (!mounted) return;
    _pendingExpandedPaths = expandedPaths;
    setState(() => _treeVersion++);
  }

  Future<void> _reloadExpandedChildren(
    TreeNode<_FileNodeData> node,
    Set<String> expandedPaths,
  ) async {
    final children = node.childrenAsList.cast<TreeNode<_FileNodeData>>();
    for (final child in children) {
      final data = child.data;
      if (data == null ||
          !data.isDirectory ||
          !expandedPaths.contains(data.path)) {
        continue;
      }
      await _loadChildren(child, rebuildTree: false);
      await _reloadExpandedChildren(child, expandedPaths);
    }
  }

  Set<String> _expandedPaths() {
    final paths = <String>{};
    _visitNodes(_tree, (node) {
      final data = node.data;
      if (data != null && data.isDirectory && node.isExpanded) {
        paths.add(data.path);
      }
    });
    return paths;
  }

  void _restorePendingExpansion() {
    final expandedPaths = _pendingExpandedPaths;
    if (expandedPaths == null) return;
    _pendingExpandedPaths = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _visitNodes(_tree, (node) => node.expansionNotifier.value = false);
      _visitNodes(_tree, (node) {
        final data = node.data;
        if (data != null &&
            data.isDirectory &&
            expandedPaths.contains(data.path) &&
            node.childrenAsList.isNotEmpty) {
          _controller?.expandNode(node);
        }
      });
    });
  }

  void _visitNodes(
    TreeNode<_FileNodeData> node,
    void Function(TreeNode<_FileNodeData> node) visitor,
  ) {
    visitor(node);
    for (final child in node.childrenAsList.cast<TreeNode<_FileNodeData>>()) {
      _visitNodes(child, visitor);
    }
  }

  Future<void> _downloadFiles(
    List<({File target, _FileNodeData data})> downloads,
  ) async {
    if (downloads.isEmpty) return;

    var completed = 0;
    _setDownloadProgress(
      completed: completed,
      total: downloads.length,
      currentName: downloads.first.data.name,
    );

    try {
      for (final download in downloads) {
        _setDownloadProgress(
          completed: completed,
          total: downloads.length,
          currentName: download.data.name,
        );
        await _source.download(download.data.path, download.target);
        completed++;
        _setDownloadProgress(
          completed: completed,
          total: downloads.length,
          currentName: download.data.name,
        );
      }
      _setDownloadProgress(
        completed: completed,
        total: downloads.length,
        currentName: downloads.last.data.name,
        finished: true,
      );
    } catch (_) {
      _setDownloadProgress(
        completed: completed,
        total: downloads.length,
        currentName:
            downloads[completed.clamp(0, downloads.length - 1)].data.name,
        failed: true,
      );
      rethrow;
    }
  }

  void _setDownloadProgress({
    required int completed,
    required int total,
    required String currentName,
    bool finished = false,
    bool failed = false,
  }) {
    if (!mounted) return;
    setState(() {
      _downloadProgress = _DownloadProgress(
        completed: completed,
        total: total,
        currentName: currentName,
        finished: finished,
        failed: failed,
      );
    });
  }

  Future<void> _runAction(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      _showMessage(error.toString());
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
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

  String _formatSize(int? bytes) {
    if (bytes == null) return '-';
    if (bytes < 1024) return '$bytes B';
    final kib = bytes / 1024;
    if (kib < 1024) return '${kib.toStringAsFixed(1)} KB';
    final mib = kib / 1024;
    if (mib < 1024) return '${mib.toStringAsFixed(1)} MB';
    return '${(mib / 1024).toStringAsFixed(1)} GB';
  }
}
