import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';

class BrowserTabBar extends ConsumerWidget {
  const BrowserTabBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(browserProvider);
    final notifier = ref.read(browserProvider.notifier);
    final theme = Theme.of(context);

    return Container(
      height: 40,
      color: theme.colorScheme.surfaceContainer,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        itemCount: state.tabs.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 2),
        itemBuilder: (context, index) {
          if (index == state.tabs.length) {
            return _AddTabButton(onTap: () => notifier.addTab());
          }
          final tab = state.tabs[index];
          final isActive = tab.id == state.activeTabId;
          return _TabChip(
            tab: tab,
            isActive: isActive,
            canClose: state.tabs.length > 1,
            onTap: () => notifier.setActiveTab(tab.id),
            onClose: () => notifier.closeTab(tab.id),
            onNavigate: (url) {
              final normalized = url.startsWith('http') ? url : 'http://$url';
              notifier.updateTab(tab.id, url: normalized);
            },
            onSwitchDevice: (device) {
              notifier.setDevice(device, tab.id);
            },
          );
        },
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final BrowserTab tab;
  final bool isActive;
  final bool canClose;
  final VoidCallback onTap;
  final VoidCallback onClose;
  final void Function(String url) onNavigate;
  final void Function(DeviceProfile device) onSwitchDevice;

  const _TabChip({
    required this.tab,
    required this.isActive,
    required this.canClose,
    required this.onTap,
    required this.onClose,
    required this.onNavigate,
    required this.onSwitchDevice,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: isActive
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        onSecondaryTapUp: (details) =>
            _showContextMenu(context, details.globalPosition),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _FaviconIcon(url: tab.effectiveFaviconUrl),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 100),
                child: Text(
                  tab.title,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: isActive
                        ? theme.colorScheme.onPrimaryContainer
                        : theme.colorScheme.onSurface,
                  ),
                ),
              ),
              if (canClose) ...[
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: onClose,
                  child: Icon(
                    Icons.close,
                    size: 14,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showContextMenu(BuildContext context, Offset position) {
    showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy,
        position.dx + 1,
        position.dy + 1,
      ),
      items: [
        const PopupMenuItem<String>(
          value: 'navigate',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.open_in_browser, size: 16),
              SizedBox(width: 8),
              Text('跳转', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        PopupMenuItem<String>(
          value: 'device',
          height: 36,
          child: Row(
            children: [
              Icon(_deviceIcon(tab.device.type), size: 16),
              const SizedBox(width: 8),
              const Text('切换设备', style: TextStyle(fontSize: 13)),
              const Spacer(),
              Text(
                tab.device.name,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
            ],
          ),
        ),
      ],
    ).then((value) {
      if (value == 'navigate') {
        _showNavigateDialog(context);
      } else if (value == 'device') {
        _showDeviceMenu(context);
      }
    });
  }

  void _showNavigateDialog(BuildContext context) {
    final controller = TextEditingController(text: tab.url);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('跳转', style: TextStyle(fontSize: 15)),
        contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(fontSize: 13),
          decoration: const InputDecoration(
            isDense: true,
            hintText: '输入 URL',
            prefixIcon: Icon(Icons.language, size: 16),
          ),
          onSubmitted: (url) {
            if (url.isNotEmpty) {
              onNavigate(url);
              Navigator.of(ctx).pop();
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                onNavigate(controller.text);
                Navigator.of(ctx).pop();
              }
            },
            child: const Text('跳转'),
          ),
        ],
      ),
    );
  }

  void _showDeviceMenu(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('切换设备', style: TextStyle(fontSize: 15)),
        children: DeviceProfile.defaults.map((d) {
          final selected = d.type == tab.device.type;
          return SimpleDialogOption(
            onPressed: () {
              onSwitchDevice(d);
              Navigator.of(ctx).pop();
            },
            child: Row(
              children: [
                Icon(_deviceIcon(d.type), size: 18),
                const SizedBox(width: 12),
                Text(
                  '${d.name} (${d.width.toInt()}x${d.height.toInt()})',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  ),
                ),
                if (selected) ...[
                  const Spacer(),
                  Icon(Icons.check, size: 16, color: Theme.of(context).colorScheme.primary),
                ],
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  IconData _deviceIcon(DeviceType type) {
    return switch (type) {
      DeviceType.phone => Icons.phone_android,
      DeviceType.tablet => Icons.tablet,
      DeviceType.desktop => Icons.desktop_windows,
    };
  }
}

class _AddTabButton extends StatelessWidget {
  final VoidCallback onTap;

  const _AddTabButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return IconButton(
      onPressed: onTap,
      icon: Icon(Icons.add, size: 18, color: theme.colorScheme.onSurfaceVariant),
      style: IconButton.styleFrom(
        minimumSize: const Size(32, 32),
        padding: EdgeInsets.zero,
      ),
    );
  }
}

class _FaviconIcon extends StatelessWidget {
  final String url;
  const _FaviconIcon({required this.url});

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return Icon(Icons.language, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant);
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: Image.network(
        url,
        width: 14,
        height: 14,
        // ignore: avoid_renaming_method_parameters
        errorBuilder: (context, error, stackTrace) => Icon(Icons.language, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
    );
  }
}
