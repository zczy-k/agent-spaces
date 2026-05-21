import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/browser_provider.dart';
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

class MoreMenuButton extends ConsumerWidget {
  final VoidCallback? onNewTab;
  final String? activeTabId;

  const MoreMenuButton({super.key, this.onNewTab, this.activeTabId});

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
          value: 'go_back',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.arrow_back_ios, size: 16),
              SizedBox(width: 8),
              Text('后退', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'go_forward',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.arrow_forward_ios, size: 16),
              SizedBox(width: 8),
              Text('前进', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'refresh',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.refresh, size: 16),
              SizedBox(width: 8),
              Text('刷新', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'split',
          height: 36,
          child: Row(
            children: [
              Icon(Icons.view_column, size: 16),
              SizedBox(width: 8),
              Text('分屏布局', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuDivider(),
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
        } else if (value == 'go_back') {
          if (activeTabId != null) WebViewService.instance.goBack(activeTabId!);
        } else if (value == 'go_forward') {
          if (activeTabId != null) WebViewService.instance.goForward(activeTabId!);
        } else if (value == 'refresh') {
          if (activeTabId != null) WebViewService.instance.reload(activeTabId!);
        } else if (value == 'split') {
          showSplitMenu(context, ref);
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

void showSplitMenu(BuildContext context, WidgetRef ref) {
  final current = ref.read(browserProvider).splitLayout;
  final notifier = ref.read(browserProvider.notifier);
  showDialog(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: const Text('分屏布局', style: TextStyle(fontSize: 15)),
      children: [
        _splitOption(ctx, notifier, SplitLayout.single, '重置布局', Icons.crop_square, current),
        _splitOption(ctx, notifier, SplitLayout.horizontal2, '左右两分屏', Icons.view_column, current),
        _splitOption(ctx, notifier, SplitLayout.vertical2, '上下两分屏', Icons.view_agenda, current),
        _splitOption(ctx, notifier, SplitLayout.horizontal3, '左右三分屏', Icons.view_carousel, current),
        _splitOption(ctx, notifier, SplitLayout.quad, '四宫格', Icons.grid_view, current),
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
