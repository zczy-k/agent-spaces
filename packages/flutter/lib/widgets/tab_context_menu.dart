import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import '../providers/bookmark_provider.dart';
import '../services/webview_service.dart';
import 'tab_widgets.dart';
import 'tab_dialogs.dart';
import 'console_sheet.dart';

class NavigationButtons extends StatelessWidget {
  final String? activeTabId;
  const NavigationButtons({super.key, this.activeTabId});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        NavButton(
          icon: Icons.arrow_back_ios,
          tooltip: '后退',
          onPressed: () => WebViewService.instance.goBack(activeTabId),
        ),
        NavButton(
          icon: Icons.arrow_forward_ios,
          tooltip: '前进',
          onPressed: () => WebViewService.instance.goForward(activeTabId),
        ),
        NavButton(
          icon: Icons.refresh,
          tooltip: '刷新',
          onPressed: () => WebViewService.instance.reload(activeTabId),
        ),
      ],
    );
  }
}

void showTabContextMenu(
  BuildContext context,
  WidgetRef ref,
  BrowserTab tab,
  Offset position,
) {
  final notifier = ref.read(browserProvider.notifier);
  final bookmarkNotifier = ref.read(bookmarkProvider.notifier);
  final isBookmarked = bookmarkNotifier.isBookmarked(tab.url);

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
            Icon(deviceIcon(tab.device.type), size: 16),
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
      PopupMenuItem<String>(
        value: 'bookmark',
        height: 36,
        child: Row(
          children: [
            Icon(
              isBookmarked ? Icons.bookmark : Icons.bookmark_outline,
              size: 16,
            ),
            const SizedBox(width: 8),
            Text(
              isBookmarked ? '从书签移除' : '添加到书签',
              style: const TextStyle(fontSize: 13),
            ),
          ],
        ),
      ),
      const PopupMenuItem<String>(
        value: 'open_external',
        height: 36,
        child: Row(
          children: [
            Icon(Icons.open_in_new, size: 16),
            SizedBox(width: 8),
            Text('用浏览器打开', style: TextStyle(fontSize: 13)),
          ],
        ),
      ),
      const PopupMenuItem<String>(
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
      const PopupMenuItem<String>(
        value: 'debug',
        height: 36,
        child: Row(
          children: [
            Icon(Icons.bug_report_outlined, size: 16),
            SizedBox(width: 8),
            Text('调试', style: TextStyle(fontSize: 13)),
          ],
        ),
      ),
      const PopupMenuItem<String>(
        value: 'console',
        height: 36,
        child: Row(
          children: [
            Icon(Icons.terminal, size: 16),
            SizedBox(width: 8),
            Text('查看控制台', style: TextStyle(fontSize: 13)),
          ],
        ),
      ),
      const PopupMenuItem<String>(
        value: 'split',
        height: 36,
        child: Row(
          children: [
            Icon(Icons.view_column, size: 16),
            SizedBox(width: 8),
            Text('分屏布局', style: TextStyle(fontSize: 13)),
            Spacer(),
            Icon(Icons.chevron_right, size: 16),
          ],
        ),
      ),
    ],
  ).then((value) {
    if (!context.mounted) return;

    if (value == 'navigate') {
      showNavigateDialog(context, tab, notifier);
    } else if (value == 'device') {
      showDeviceMenu(context, tab, notifier);
    } else if (value == 'bookmark') {
      if (isBookmarked) {
        final bm = bookmarkNotifier.findByUrl(tab.url);
        if (bm != null) bookmarkNotifier.removeBookmark(bm.id);
      } else {
        bookmarkNotifier.addBookmark(
          name: tab.title,
          url: tab.url,
          deviceType: tab.device.type,
        );
      }
    } else if (value == 'open_external') {
      launchUrl(Uri.parse(tab.url));
    } else if (value == 'refresh') {
      WebViewService.instance.reload(tab.id);
    } else if (value == 'debug') {
      showDebugDialog(context, ref, tab);
    } else if (value == 'console') {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        builder: (_) => const ConsoleSheet(),
      );
    } else if (value == 'split') {
      showSplitMenu(context, ref);
    }
  });
}

void showSplitMenu(BuildContext context, WidgetRef ref) {
  final current = ref.read(browserProvider).splitLayout;
  final notifier = ref.read(browserProvider.notifier);
  showDialog(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: const Text('分屏布局', style: TextStyle(fontSize: 15)),
      children: [
        _splitOption(ctx, ref, notifier, SplitLayout.single, '重置布局', Icons.crop_square, current),
        _splitOption(ctx, ref, notifier, SplitLayout.horizontal2, '左右两分屏', Icons.view_column, current),
        _splitOption(ctx, ref, notifier, SplitLayout.vertical2, '上下两分屏', Icons.view_agenda, current),
        _splitOption(ctx, ref, notifier, SplitLayout.horizontal3, '左右三分屏', Icons.view_carousel, current),
        _splitOption(ctx, ref, notifier, SplitLayout.quad, '四宫格', Icons.grid_view, current),
      ],
    ),
  );
}

SimpleDialogOption _splitOption(
  BuildContext ctx,
  WidgetRef ref,
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
