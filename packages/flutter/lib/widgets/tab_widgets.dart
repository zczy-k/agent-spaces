import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
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

List<PopupMenuEntry<VoidCallback>> buildBrowserMenuItems(
  BuildContext context,
  WidgetRef ref, {
  required String? activeTabId,
  VoidCallback? onNewTab,
  VoidCallback? onNewTerminal,
}) {
  void runWithActiveTab(void Function(String tabId) action) {
    final tabId = activeTabId;
    if (tabId != null && tabId.isNotEmpty) {
      action(tabId);
    }
  }

  return [
    if (onNewTab != null)
      PopupMenuItem<VoidCallback>(value: onNewTab, child: Text('tab_new_tab'.tr())),
    if (onNewTerminal != null)
      PopupMenuItem<VoidCallback>(
        value: onNewTerminal,
        child: Text('tab_new_terminal'.tr()),
      ),
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
      title: Text('tab_split_layout'.tr(), style: const TextStyle(fontSize: 15)),
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
