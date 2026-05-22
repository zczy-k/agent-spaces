import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:easy_localization/easy_localization.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import '../providers/bookmark_provider.dart';
import '../services/webview_service.dart';
import 'tab_widgets.dart';
import 'tab_dialogs.dart';
import 'console_sheet.dart';

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
      PopupMenuItem<String>(
        value: 'navigate',
        height: 36,
        child: Row(
          children: [
            const Icon(Icons.open_in_browser, size: 16),
            const SizedBox(width: 8),
            Text('tab_navigate'.tr(), style: const TextStyle(fontSize: 13)),
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
            Text('settings_device_selector'.tr(), style: const TextStyle(fontSize: 13)),
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
              isBookmarked ? 'tab_remove_bookmark'.tr() : 'tab_add_bookmark'.tr(),
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
            Text('tab_open_in_browser', style: TextStyle(fontSize: 13)),
          ],
        ),
      ),
      PopupMenuItem<String>(
        value: 'refresh',
        height: 36,
        child: Row(
          children: [
            const Icon(Icons.refresh, size: 16),
            const SizedBox(width: 8),
            Text('tab_refresh'.tr(), style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
      PopupMenuItem<String>(
        value: 'debug',
        height: 36,
        child: Row(
          children: [
            const Icon(Icons.bug_report_outlined, size: 16),
            const SizedBox(width: 8),
            Text('tab_debug'.tr(), style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
      PopupMenuItem<String>(
        value: 'console',
        height: 36,
        child: Row(
          children: [
            const Icon(Icons.terminal, size: 16),
            const SizedBox(width: 8),
            Text('tab_view_console'.tr(), style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
      PopupMenuItem<String>(
        value: 'split',
        height: 36,
        child: Row(
          children: [
            const Icon(Icons.view_column, size: 16),
            const SizedBox(width: 8),
            Text('tab_split_layout'.tr(), style: const TextStyle(fontSize: 13)),
            const Spacer(),
            const Icon(Icons.chevron_right, size: 16),
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
