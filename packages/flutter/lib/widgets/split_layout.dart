import 'package:docking/docking.dart';
import 'package:flutter/material.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import 'tab_widgets.dart';
import 'webview_instance.dart';

typedef TitleChangedCallback =
    void Function(String tabId, String title, String url, String? faviconUrl);
typedef TabSelectedCallback = void Function(String tabId);
typedef TabClosedCallback = void Function(String tabId);
typedef DockingMenuBuilder =
    List<TabbedViewMenuItem> Function(BuildContext context);

Widget _buildWebViewPane(
  BrowserTab tab,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  return WebViewInstance(
    key: ValueKey('${tab.id}-$webViewDebuggingEnabled'),
    tab: tab,
    onTitleChanged: onTitleChanged,
  );
}

Widget buildSplitLayout({
  required BuildContext context,
  required SplitLayout layout,
  required List<BrowserTab> visibleTabs,
  required bool webViewDebuggingEnabled,
  required TitleChangedCallback onTitleChanged,
  required TabSelectedCallback onTabSelected,
  required TabClosedCallback onTabClosed,
  required VoidCallback onNewTab,
  required DockingMenuBuilder onBuildMenu,
}) {
  if (visibleTabs.isEmpty) return const SizedBox.shrink();

  final root = switch (layout) {
    SplitLayout.single => _buildDockingTabs(
      visibleTabs,
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
    SplitLayout.horizontal2 => _buildDockingRow(
      _buildTabGroups(visibleTabs, 2),
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
    SplitLayout.vertical2 => _buildDockingColumn(
      _buildTabGroups(visibleTabs, 2),
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
    SplitLayout.horizontal3 => _buildDockingRow(
      _buildTabGroups(visibleTabs, 3),
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
    SplitLayout.quad => _buildDockingColumn(
      _chunkTabGroups(_buildTabGroups(visibleTabs, 4), 2)
          .map(
            (rowGroups) => _buildDockingRow(
              rowGroups,
              webViewDebuggingEnabled,
              onTitleChanged,
            ),
          )
          .toList(),
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
  };

  return TabbedViewTheme(
    data: TabbedViewThemeData.minimalist(),
    child: Docking(
      key: ValueKey(
        'split-${layout.name}-${visibleTabs.map((tab) => tab.id).join('-')}',
      ),
      layout: DockingLayout(root: root),
      onItemSelection: (item) {
        final tabId = item.value;
        if (tabId is String) onTabSelected(tabId);
      },
      onItemClose: (item) {
        final tabId = item.value;
        if (tabId is String) onTabClosed(tabId);
      },
      dockingButtonsBuilder: (context, dockingTabs, dockingItem) => [
        TabButton(
          icon: IconProvider.data(Icons.add),
          toolTip: '新建标签页',
          onPressed: onNewTab,
        ),
        TabButton(
          icon: IconProvider.data(Icons.more_vert),
          toolTip: '更多',
          menuBuilder: onBuildMenu,
        ),
      ],
      draggable: true,
      maximizableItem: false,
      maximizableTab: false,
      maximizableTabsArea: false,
    ),
  );
}

List<List<BrowserTab>> _buildTabGroups(List<BrowserTab> tabs, int groupCount) {
  final groups = List.generate(groupCount, (_) => <BrowserTab>[]);
  for (int i = 0; i < tabs.length; i++) {
    groups[i % groupCount].add(tabs[i]);
  }
  return groups.where((group) => group.isNotEmpty).toList();
}

List<List<List<BrowserTab>>> _chunkTabGroups(
  List<List<BrowserTab>> groups,
  int chunkSize,
) {
  final chunks = <List<List<BrowserTab>>>[];
  for (int i = 0; i < groups.length; i += chunkSize) {
    chunks.add(groups.sublist(i, (i + chunkSize).clamp(0, groups.length)));
  }
  return chunks;
}

DockingArea _buildDockingRow(
  List<dynamic> children,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final areas = children.map((child) {
    if (child is DockingArea) return child;
    return _buildDockingTabs(
      child as List<BrowserTab>,
      webViewDebuggingEnabled,
      onTitleChanged,
    );
  }).toList();
  return areas.length == 1 ? areas.first : DockingRow(areas);
}

DockingArea _buildDockingColumn(
  List<dynamic> children,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final areas = children.map((child) {
    if (child is DockingArea) return child;
    return _buildDockingTabs(
      child as List<BrowserTab>,
      webViewDebuggingEnabled,
      onTitleChanged,
    );
  }).toList();
  return areas.length == 1 ? areas.first : DockingColumn(areas);
}

DockingArea _buildDockingTabs(
  List<BrowserTab> tabs,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final items = tabs.map((tab) {
    return DockingItem(
      id: tab.id,
      name: tab.title,
      value: tab.id,
      closable: true,
      keepAlive: true,
      leading: (context, status) => FaviconIcon(url: tab.effectiveFaviconUrl),
      widget: _buildWebViewPane(tab, webViewDebuggingEnabled, onTitleChanged),
    );
  }).toList();

  return items.length == 1 ? items.first : DockingTabs(items);
}
