import 'package:buttons_tabbar/buttons_tabbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/browser_provider.dart';
import 'tab_widgets.dart';
import 'tab_context_menu.dart';
import 'tab_dialogs.dart';

class BrowserTabBar extends ConsumerStatefulWidget {
  const BrowserTabBar({super.key});

  @override
  ConsumerState<BrowserTabBar> createState() => _BrowserTabBarState();
}

class _BrowserTabBarState extends ConsumerState<BrowserTabBar>
    with TickerProviderStateMixin {
  TabController? _controller;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(browserProvider);
    final notifier = ref.read(browserProvider.notifier);
    final theme = Theme.of(context);
    final tabCount = state.tabs.length;
    final activeIndex = state.tabs
        .indexWhere((t) => t.id == state.activeTabId)
        .clamp(0, tabCount > 0 ? tabCount - 1 : 0);

    if (_controller?.length != tabCount) {
      _controller?.dispose();
      _controller = tabCount > 0
          ? TabController(
              length: tabCount,
              initialIndex: activeIndex,
              vsync: this,
            )
          : null;
    }

    if (tabCount == 0) {
      return Container(
        height: 40,
        color: theme.colorScheme.surfaceContainer,
        child: Row(
          children: [
            const Spacer(),
            MoreMenuButton(
              onNewTab: () => showNewTabDialog(context, notifier),
              activeTabId: state.activeTabId,
            ),
          ],
        ),
      );
    }

    return Container(
      height: 40,
      color: theme.colorScheme.surfaceContainer,
      child: Row(
        children: [
          const SizedBox.shrink(),
          Expanded(
            child: ButtonsTabBar(
              controller: _controller,
              backgroundColor: theme.colorScheme.primaryContainer,
              unselectedBackgroundColor: theme.colorScheme.surface,
              labelStyle: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onPrimaryContainer,
              ),
              unselectedLabelStyle: TextStyle(
                fontSize: 12,
                color: theme.colorScheme.onSurface,
              ),
              borderWidth: 0,
              radius: 8,
              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
              buttonMargin: const EdgeInsets.symmetric(
                horizontal: 1,
                vertical: 4,
              ),
              onTap: (index) {
                _hideKeyboard();
                if (index < tabCount) {
                  notifier.setActiveTab(state.tabs[index].id);
                }
              },
              tabs: state.tabs.map((tab) {
                return Tab(
                  child: GestureDetector(
                    onLongPressStart: (details) => showTabContextMenu(
                      context,
                      ref,
                      tab,
                      details.globalPosition,
                    ),
                    onSecondaryTapUp: (details) => showTabContextMenu(
                      context,
                      ref,
                      tab,
                      details.globalPosition,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FaviconIcon(url: tab.effectiveFaviconUrl),
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 80),
                          child: Text(
                            tab.title,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () => notifier.closeTab(tab.id),
                          child: Icon(
                            Icons.close,
                            size: 14,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          MoreMenuButton(
              onNewTab: () => showNewTabDialog(context, notifier)),
          const SizedBox(width: 4),
        ],
      ),
    );
  }

  void _hideKeyboard() {
    FocusManager.instance.primaryFocus?.unfocus();
    SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
  }
}
