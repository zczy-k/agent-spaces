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

class SplitLayoutView extends StatefulWidget {
  final SplitLayout layout;
  final List<BrowserTab> visibleTabs;
  final bool webViewDebuggingEnabled;
  final TitleChangedCallback onTitleChanged;
  final TabSelectedCallback onTabSelected;
  final TabClosedCallback onTabClosed;
  final VoidCallback onNewTab;
  final DockingMenuBuilder onBuildMenu;

  const SplitLayoutView({
    super.key,
    required this.layout,
    required this.visibleTabs,
    required this.webViewDebuggingEnabled,
    required this.onTitleChanged,
    required this.onTabSelected,
    required this.onTabClosed,
    required this.onNewTab,
    required this.onBuildMenu,
  });

  @override
  State<SplitLayoutView> createState() => _SplitLayoutViewState();
}

class _SplitLayoutViewState extends State<SplitLayoutView> {
  DockingLayout? _dockingLayout;
  String _structureKey = '';

  @override
  void initState() {
    super.initState();
    _rebuildLayout();
  }

  @override
  void didUpdateWidget(covariant SplitLayoutView oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextStructureKey = _buildStructureKey();
    if (nextStructureKey != _structureKey) {
      _rebuildLayout(structureKey: nextStructureKey);
    } else {
      _syncDockingItems();
    }
  }

  @override
  Widget build(BuildContext context) {
    final layout = _dockingLayout;
    if (layout == null) return const SizedBox.shrink();

    return TabbedViewTheme(
      data: TabbedViewThemeData.minimalist(),
      child: Docking(
        layout: layout,
        onItemSelection: (item) {
          final tabId = item.value;
          if (tabId is String) widget.onTabSelected(tabId);
        },
        onItemClose: (item) {
          final tabId = item.value;
          if (tabId is String) widget.onTabClosed(tabId);
        },
        dockingButtonsBuilder: (context, dockingTabs, dockingItem) => [
          TabButton(
            icon: IconProvider.data(Icons.add),
            toolTip: '新建标签页',
            onPressed: widget.onNewTab,
          ),
          TabButton(
            icon: IconProvider.data(Icons.more_vert),
            toolTip: '更多',
            menuBuilder: widget.onBuildMenu,
          ),
        ],
        draggable: true,
        maximizableItem: false,
        maximizableTab: false,
        maximizableTabsArea: false,
      ),
    );
  }

  String _buildStructureKey() {
    final tabStructure = widget.layout == SplitLayout.single
        ? widget.visibleTabs.map((tab) => tab.device.type.name).join('|')
        : widget.visibleTabs
              .map((tab) => '${tab.id}:${tab.device.type.name}')
              .join('|');
    return '${widget.layout.name}:${widget.webViewDebuggingEnabled}:$tabStructure';
  }

  void _rebuildLayout({String? structureKey}) {
    _structureKey = structureKey ?? _buildStructureKey();
    _dockingLayout = DockingLayout(root: _buildRoot());
  }

  DockingArea _buildRoot() {
    return switch (widget.layout) {
      SplitLayout.single => _buildDockingTabs(
        widget.visibleTabs,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.horizontal2 => _buildDockingRow(
        _buildTabGroups(widget.visibleTabs, 2),
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.vertical2 => _buildDockingColumn(
        _buildTabGroups(widget.visibleTabs, 2),
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.horizontal3 => _buildDockingRow(
        _buildTabGroups(widget.visibleTabs, 3),
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.quad => _buildDockingColumn(
        _chunkTabGroups(_buildTabGroups(widget.visibleTabs, 4), 2)
            .map(
              (rowGroups) => _buildDockingRow(
                rowGroups,
                widget.webViewDebuggingEnabled,
                widget.onTitleChanged,
              ),
            )
            .toList(),
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
    };
  }

  void _syncDockingItems() {
    final layout = _dockingLayout;
    if (layout == null) return;
    final tabsById = {for (final tab in widget.visibleTabs) tab.id: tab};
    final existingIds = layout
        .layoutAreas()
        .whereType<DockingItem>()
        .map((item) => item.value)
        .whereType<String>()
        .toSet();
    final visibleIds = tabsById.keys.toSet();

    final removedIds = existingIds.difference(visibleIds).toList();
    if (removedIds.isNotEmpty) {
      layout.removeItemByIds(removedIds);
    }

    for (final tab in widget.visibleTabs) {
      if (layout.findDockingItem(tab.id) != null) continue;
      layout.addItemOnRoot(
        newItem: _buildDockingItem(
          tab,
          widget.webViewDebuggingEnabled,
          widget.onTitleChanged,
        ),
        dropIndex: layout.layoutAreas().whereType<DockingItem>().length,
      );
    }

    for (final area in layout.layoutAreas()) {
      if (area is! DockingItem || area.value is! String) continue;
      final tab = tabsById[area.value as String];
      if (tab == null) continue;
      area.name = tab.title;
      area.widget = _buildWebViewPane(
        tab,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      );
      area.leading = (context, status) =>
          FaviconIcon(url: tab.effectiveFaviconUrl);
    }
    layout.rebuild();
  }
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
  return SplitLayoutView(
    layout: layout,
    visibleTabs: visibleTabs,
    webViewDebuggingEnabled: webViewDebuggingEnabled,
    onTitleChanged: onTitleChanged,
    onTabSelected: onTabSelected,
    onTabClosed: onTabClosed,
    onNewTab: onNewTab,
    onBuildMenu: onBuildMenu,
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
  final items = tabs
      .map(
        (tab) =>
            _buildDockingItem(tab, webViewDebuggingEnabled, onTitleChanged),
      )
      .toList();

  return items.length == 1 ? items.first : DockingTabs(items);
}

DockingItem _buildDockingItem(
  BrowserTab tab,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  return DockingItem(
    id: tab.id,
    name: tab.title,
    value: tab.id,
    closable: true,
    keepAlive: true,
    leading: (context, status) => FaviconIcon(url: tab.effectiveFaviconUrl),
    widget: _buildWebViewPane(tab, webViewDebuggingEnabled, onTitleChanged),
  );
}
