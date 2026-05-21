import 'package:docking/docking.dart';
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

List<TabbedViewMenuItem> buildBrowserMenuItems(
  BuildContext context,
  WidgetRef ref, {
  required String? activeTabId,
  VoidCallback? onNewTab,
}) {
  void runWithActiveTab(void Function(String tabId) action) {
    final tabId = activeTabId;
    if (tabId != null && tabId.isNotEmpty) {
      action(tabId);
    }
  }

  return [
    if (onNewTab != null)
      TabbedViewMenuItem(text: '新建标签页', onSelection: onNewTab),
    TabbedViewMenuItem(
      text: '后退',
      onSelection: () => runWithActiveTab(WebViewService.instance.goBack),
    ),
    TabbedViewMenuItem(
      text: '前进',
      onSelection: () => runWithActiveTab(WebViewService.instance.goForward),
    ),
    TabbedViewMenuItem(
      text: '刷新',
      onSelection: () => runWithActiveTab(WebViewService.instance.reload),
    ),
    TabbedViewMenuItem(
      text: '分屏布局',
      onSelection: () => showSplitMenu(context, ref),
    ),
    TabbedViewMenuItem(
      text: '书签',
      onSelection: () => context.push('/bookmarks'),
    ),
    TabbedViewMenuItem(
      text: '设置',
      onSelection: () => context.push('/settings'),
    ),
  ];
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
        _splitOption(
          ctx,
          notifier,
          SplitLayout.single,
          '重置布局',
          Icons.crop_square,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.horizontal2,
          '左右两分屏',
          Icons.view_column,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.vertical2,
          '上下两分屏',
          Icons.view_agenda,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.horizontal3,
          '左右三分屏',
          Icons.view_carousel,
          current,
        ),
        _splitOption(
          ctx,
          notifier,
          SplitLayout.quad,
          '四宫格',
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
