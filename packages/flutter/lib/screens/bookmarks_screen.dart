import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import '../models/browser_tab.dart';
import '../models/bookmark.dart';
import '../providers/browser_provider.dart';
import '../providers/bookmark_provider.dart';

class BookmarksScreen extends ConsumerWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookmarks = ref.watch(bookmarkProvider);
    final bookmarkNotifier = ref.read(bookmarkProvider.notifier);
    final browserNotifier = ref.read(browserProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('bookmarks'.tr(), style: const TextStyle(fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, size: 20),
            onPressed: () => _showAddDialog(context, bookmarkNotifier),
          ),
        ],
      ),
      body: bookmarks.isEmpty
          ? Center(
              child: Text('bookmarks_empty'.tr(), style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
            )
          : ListView.separated(
              itemCount: bookmarks.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final bm = bookmarks[index];
                return ListTile(
                  dense: true,
                  leading: Icon(_deviceIcon(bm.deviceType), size: 18),
                  title: Text(bm.name, style: const TextStyle(fontSize: 13)),
                  subtitle: Text(bm.url, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurfaceVariant)),
                  onTap: () {
                    browserNotifier.addTab(
                      url: bm.url,
                      title: bm.name,
                      device: DeviceProfile.fromType(bm.deviceType),
                    );
                    Navigator.of(context).pop();
                  },
                  onLongPress: () => _showActionSheet(context, bookmarkNotifier, bm),
                );
              },
            ),
    );
  }

  void _showAddDialog(BuildContext context, BookmarkNotifier notifier) {
    final nameCtl = TextEditingController();
    final urlCtl = TextEditingController();
    DeviceType deviceType = DeviceType.desktop;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text('bookmarks_add'.tr(), style: const TextStyle(fontSize: 15)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtl,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'bookmarks_name'.tr(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: urlCtl,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'bookmarks_url'.tr(),
                  prefixIcon: const Icon(Icons.language, size: 16),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<DeviceType>(
                initialValue: deviceType,
                isDense: true,
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'bookmarks_device_type'.tr(),
                ),
                items: DeviceType.values.map((t) => DropdownMenuItem(
                  value: t,
                  child: Text(_deviceTypeName(t), style: const TextStyle(fontSize: 13)),
                )).toList(),
                onChanged: (v) => setState(() => deviceType = v!),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('cancel'.tr()),
            ),
            TextButton(
              onPressed: () {
                if (nameCtl.text.isNotEmpty && urlCtl.text.isNotEmpty) {
                  final url = urlCtl.text.startsWith('http') ? urlCtl.text : 'http://${urlCtl.text}';
                  notifier.addBookmark(name: nameCtl.text, url: url, deviceType: deviceType);
                  Navigator.of(ctx).pop();
                }
              },
              child: Text('add'.tr()),
            ),
          ],
        ),
      ),
    );
  }

  void _showActionSheet(BuildContext context, BookmarkNotifier notifier, Bookmark bm) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined, size: 20),
              title: Text('edit'.tr(), style: const TextStyle(fontSize: 14)),
              onTap: () {
                Navigator.of(ctx).pop();
                _showEditDialog(context, notifier, bm);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, size: 20),
              title: Text('delete'.tr(), style: const TextStyle(fontSize: 14)),
              onTap: () {
                Navigator.of(ctx).pop();
                notifier.removeBookmark(bm.id);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(BuildContext context, BookmarkNotifier notifier, Bookmark bm) {
    final nameCtl = TextEditingController(text: bm.name);
    final urlCtl = TextEditingController(text: bm.url);
    DeviceType deviceType = bm.deviceType;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: Text('bookmarks_edit'.tr(), style: const TextStyle(fontSize: 15)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtl,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(isDense: true, labelText: 'bookmarks_name'.tr()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: urlCtl,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  isDense: true,
                  labelText: 'bookmarks_url'.tr(),
                  prefixIcon: const Icon(Icons.language, size: 16),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<DeviceType>(
                initialValue: deviceType,
                isDense: true,
                decoration: InputDecoration(isDense: true, labelText: 'bookmarks_device_type'.tr()),
                items: DeviceType.values.map((t) => DropdownMenuItem(
                  value: t,
                  child: Text(_deviceTypeName(t), style: const TextStyle(fontSize: 13)),
                )).toList(),
                onChanged: (v) => setState(() => deviceType = v!),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('cancel'.tr()),
            ),
            TextButton(
              onPressed: () {
                if (nameCtl.text.isNotEmpty && urlCtl.text.isNotEmpty) {
                  final url = urlCtl.text.startsWith('http') ? urlCtl.text : 'http://${urlCtl.text}';
                  notifier.updateBookmark(bm.id, name: nameCtl.text, url: url, deviceType: deviceType);
                  Navigator.of(ctx).pop();
                }
              },
              child: Text('save'.tr()),
            ),
          ],
        ),
      ),
    );
  }

  String _deviceTypeName(DeviceType t) => switch (t) {
    DeviceType.phone => 'bookmarks_phone'.tr(),
    DeviceType.tablet => 'bookmarks_tablet'.tr(),
    DeviceType.desktop => 'bookmarks_desktop'.tr(),
  };

  IconData _deviceIcon(DeviceType t) => switch (t) {
    DeviceType.phone => Icons.phone_android,
    DeviceType.tablet => Icons.tablet,
    DeviceType.desktop => Icons.desktop_windows,
  };
}
