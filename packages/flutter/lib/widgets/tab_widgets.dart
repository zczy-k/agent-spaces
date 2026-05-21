import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

class MoreMenuButton extends ConsumerWidget {
  final VoidCallback? onNewTab;

  const MoreMenuButton({super.key, this.onNewTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return PopupMenuButton<String>(
      icon: Icon(
        Icons.more_vert,
        size: 18,
        color: theme.colorScheme.onSurfaceVariant,
      ),
      style: IconButton.styleFrom(
        minimumSize: const Size(32, 32),
        padding: EdgeInsets.zero,
      ),
      offset: const Offset(0, 40),
      itemBuilder: (_) => [
        if (onNewTab != null)
          const PopupMenuItem(
            value: 'new_tab',
            height: 36,
            child: Row(
              children: [
                Icon(Icons.add, size: 16),
                SizedBox(width: 8),
                Text('新建标签页', style: TextStyle(fontSize: 13)),
              ],
            ),
          ),
        const PopupMenuItem(
          value: 'bookmarks',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.bookmark_outline, size: 16),
              SizedBox(width: 8),
              Text('书签', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'settings',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.settings, size: 16),
              SizedBox(width: 8),
              Text('设置', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
      ],
      onSelected: (value) {
        if (value == 'new_tab') {
          onNewTab?.call();
        } else if (value == 'bookmarks') {
          context.push('/bookmarks');
        } else if (value == 'settings') {
          context.push('/settings');
        }
      },
    );
  }
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
