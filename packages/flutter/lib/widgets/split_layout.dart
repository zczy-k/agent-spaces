import 'package:docking/docking.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import 'tab_widgets.dart';
import 'terminal_instance.dart';
import 'webview_instance.dart';

typedef TitleChangedCallback =
    void Function(String tabId, String title, String url, String? faviconUrl);
typedef TabSelectedCallback = void Function(String tabId);
typedef TabClosedCallback = void Function(String tabId);
typedef DockingMenuBuilder =
    List<PopupMenuEntry<VoidCallback>> Function(BuildContext context);
typedef DockingLayoutChangedCallback = void Function(String layout);

class _StringLayoutParser extends LayoutParser with LayoutParserMixin {}

class _BrowserDockingAreaBuilder extends AreaBuilder with AreaBuilderMixin {
  _BrowserDockingAreaBuilder({
    required this.tabsById,
    required this.webViewDebuggingEnabled,
    required this.onTitleChanged,
  });

  final Map<String, BrowserTab> tabsById;
  final bool webViewDebuggingEnabled;
  final TitleChangedCallback onTitleChanged;

  @override
  DockingItem buildDockingItem({
    required dynamic id,
    required double? weight,
    required bool maximized,
  }) {
    final tab = tabsById[id];
    if (tab == null) {
      throw ArgumentError('Saved layout references an unknown tab: $id');
    }
    return _buildDockingItem(
      tab,
      webViewDebuggingEnabled,
      onTitleChanged,
      weight: weight,
      maximized: maximized,
    );
  }
}

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

Widget _buildTabPane(
  BrowserTab tab,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  return switch (tab.type) {
    BrowserTabType.webview => _buildWebViewPane(
      tab,
      webViewDebuggingEnabled,
      onTitleChanged,
    ),
    BrowserTabType.terminal => TerminalInstance(
      key: ValueKey(tab.id),
      tab: tab,
      onTitleChanged: (title) => onTitleChanged(tab.id, title, tab.url, null),
    ),
  };
}

Widget _buildTabLeading(BuildContext context, BrowserTab tab) {
  if (tab.type == BrowserTabType.terminal) {
    return Icon(
      Icons.terminal,
      size: 14,
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
  }
  return FaviconIcon(url: tab.effectiveFaviconUrl);
}

TabbedViewThemeData _buildDockingTabTheme(ThemeData theme) {
  final colorScheme = theme.colorScheme;
  final borderColor = colorScheme.outlineVariant.withValues(alpha: 0.8);
  final tabRadius = BorderRadius.circular(8);
  final selectedIndicator = BorderSide(color: colorScheme.primary, width: 2);

  return TabbedViewThemeData.minimalist()
    ..materialDesignIcons()
    ..tabsArea.color = colorScheme.surface
    ..tabsArea.border = Border(bottom: BorderSide(color: borderColor))
    ..tabsArea.buttonsAreaDecoration = BoxDecoration(color: colorScheme.surface)
    ..tabsArea.buttonsAreaPadding = const EdgeInsets.symmetric(
      horizontal: 6,
      vertical: 4,
    )
    ..tabsArea.buttonPadding = const EdgeInsets.all(4)
    ..tabsArea.buttonIconSize = 16
    ..tabsArea.buttonsGap = 2
    ..tabsArea.normalButtonColor = colorScheme.onSurfaceVariant
    ..tabsArea.hoverButtonColor = colorScheme.onSurface
    ..tabsArea.disabledButtonColor = colorScheme.onSurface.withValues(
      alpha: 0.32,
    )
    ..tabsArea.hoverButtonBackground = BoxDecoration(
      color: colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(6),
    )
    ..tab.textStyle = theme.textTheme.labelLarge?.copyWith(
      color: colorScheme.onSurfaceVariant,
      fontWeight: FontWeight.w500,
    )
    ..tab.padding = const EdgeInsets.fromLTRB(10, 6, 6, 5)
    ..tab.paddingWithoutButton = const EdgeInsets.fromLTRB(10, 6, 10, 5)
    ..tab.margin = const EdgeInsets.fromLTRB(4, 4, 0, 0)
    ..tab.decoration = BoxDecoration(
      color: colorScheme.surfaceContainer,
      borderRadius: tabRadius,
    )
    ..tab.draggingDecoration = BoxDecoration(
      color: colorScheme.surfaceContainerHighest,
      borderRadius: tabRadius,
    )
    ..tab.innerBottomBorder = BorderSide(
      color: Colors.transparent,
      width: selectedIndicator.width,
    )
    ..tab.normalButtonColor = colorScheme.onSurfaceVariant
    ..tab.hoverButtonColor = colorScheme.onSurface
    ..tab.disabledButtonColor = colorScheme.onSurface.withValues(alpha: 0.32)
    ..tab.buttonIconSize = 16
    ..tab.buttonPadding = const EdgeInsets.all(3)
    ..tab.buttonsOffset = 6
    ..tab.buttonsGap = 2
    ..tab.hoverButtonBackground = BoxDecoration(
      color: colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(6),
    )
    ..tab.highlightedStatus = TabStatusThemeData(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: tabRadius,
      ),
    )
    ..tab.selectedStatus = TabStatusThemeData(
      fontColor: colorScheme.onSurface,
      innerBottomBorder: selectedIndicator,
      normalButtonColor: colorScheme.onSurface,
      hoverButtonColor: colorScheme.onSurface,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: tabRadius,
      ),
    );
}

void _showDockingMenu(BuildContext context, DockingMenuBuilder menuBuilder) {
  final overlay = Overlay.of(context).context.findRenderObject();
  final renderBox = context.findRenderObject();
  if (overlay is! RenderBox || renderBox is! RenderBox) return;

  final offset = renderBox.localToGlobal(Offset.zero, ancestor: overlay);
  final position = RelativeRect.fromRect(
    Rect.fromLTWH(
      offset.dx,
      offset.dy + renderBox.size.height,
      renderBox.size.width,
      renderBox.size.height,
    ),
    Offset.zero & overlay.size,
  );

  showMenu<VoidCallback>(
    context: context,
    position: position,
    items: menuBuilder(context),
  ).then((action) => action?.call());
}

class SplitLayoutView extends StatefulWidget {
  final SplitLayout layout;
  final List<BrowserTab> visibleTabs;
  final String activeTabId;
  final String? savedDockingLayout;
  final bool webViewDebuggingEnabled;
  final TitleChangedCallback onTitleChanged;
  final TabSelectedCallback onTabSelected;
  final TabClosedCallback onTabClosed;
  final VoidCallback onNewTab;
  final VoidCallback onNewTerminal;
  final DockingMenuBuilder onBuildMenu;
  final DockingLayoutChangedCallback onDockingLayoutChanged;

  const SplitLayoutView({
    super.key,
    required this.layout,
    required this.visibleTabs,
    required this.activeTabId,
    this.savedDockingLayout,
    required this.webViewDebuggingEnabled,
    required this.onTitleChanged,
    required this.onTabSelected,
    required this.onTabClosed,
    required this.onNewTab,
    required this.onNewTerminal,
    required this.onBuildMenu,
    required this.onDockingLayoutChanged,
  });

  @override
  State<SplitLayoutView> createState() => _SplitLayoutViewState();
}

class _SplitLayoutViewState extends State<SplitLayoutView> {
  static final _layoutParser = _StringLayoutParser();
  DockingLayout? _dockingLayout;
  String _structureKey = '';
  String _lastSavedDockingLayout = '';
  bool _hasRestoredSavedDockingLayout = false;

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
  void dispose() {
    _dockingLayout?.removeListener(_handleDockingLayoutChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final layout = _dockingLayout;
    if (layout == null) return const SizedBox.shrink();

    return TabbedViewTheme(
      data: _buildDockingTabTheme(Theme.of(context)),
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
            icon: IconProvider.data(Icons.more_vert),
            toolTip: 'tab_more'.tr(),
            onPressed: () => _showDockingMenu(context, widget.onBuildMenu),
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
    _dockingLayout?.removeListener(_handleDockingLayoutChanged);
    final layout = DockingLayout(root: _buildRoot());
    final restored = _restoreSavedDockingLayout(layout);
    _selectDockingItem(layout, widget.activeTabId);
    _lastSavedDockingLayout = _stringifyLayout(layout);
    layout.addListener(_handleDockingLayoutChanged);
    _dockingLayout = layout;
    if (!restored) {
      widget.onDockingLayoutChanged(_lastSavedDockingLayout);
    }
  }

  bool _restoreSavedDockingLayout(DockingLayout layout) {
    final savedLayout = widget.savedDockingLayout;
    if (_hasRestoredSavedDockingLayout ||
        savedLayout == null ||
        savedLayout.isEmpty) {
      return false;
    }
    _hasRestoredSavedDockingLayout = true;
    try {
      layout.load(
        layout: savedLayout,
        parser: _layoutParser,
        builder: _BrowserDockingAreaBuilder(
          tabsById: {for (final tab in widget.visibleTabs) tab.id: tab},
          webViewDebuggingEnabled: widget.webViewDebuggingEnabled,
          onTitleChanged: widget.onTitleChanged,
        ),
      );
      return true;
    } catch (_) {
      layout.root = _buildRoot();
      return false;
    }
  }

  void _handleDockingLayoutChanged() {
    final layout = _dockingLayout;
    if (layout == null) return;
    final serialized = _stringifyLayout(layout);
    if (serialized == _lastSavedDockingLayout) return;
    _lastSavedDockingLayout = serialized;
    widget.onDockingLayoutChanged(serialized);
  }

  DockingArea _buildRoot() {
    return switch (widget.layout) {
      SplitLayout.single => _buildDockingTabs(
        widget.visibleTabs,
        widget.activeTabId,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.horizontal2 => _buildDockingRow(
        _buildTabGroups(widget.visibleTabs, 2),
        widget.activeTabId,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.vertical2 => _buildDockingColumn(
        _buildTabGroups(widget.visibleTabs, 2),
        widget.activeTabId,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.horizontal3 => _buildDockingRow(
        _buildTabGroups(widget.visibleTabs, 3),
        widget.activeTabId,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      ),
      SplitLayout.quad => _buildDockingColumn(
        _chunkTabGroups(_buildTabGroups(widget.visibleTabs, 4), 2)
            .map(
              (rowGroups) => _buildDockingRow(
                rowGroups,
                widget.activeTabId,
                widget.webViewDebuggingEnabled,
                widget.onTitleChanged,
              ),
            )
            .toList(),
        widget.activeTabId,
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

    _selectDockingItem(layout, widget.activeTabId);

    for (final area in layout.layoutAreas()) {
      if (area is! DockingItem || area.value is! String) continue;
      final tab = tabsById[area.value as String];
      if (tab == null) continue;
      area.name = tab.title;
      area.widget = _buildTabPane(
        tab,
        widget.webViewDebuggingEnabled,
        widget.onTitleChanged,
      );
      area.leading = (context, status) => _buildTabLeading(context, tab);
    }
    layout.rebuild();
  }
}

Widget buildSplitLayout({
  required BuildContext context,
  required SplitLayout layout,
  required List<BrowserTab> visibleTabs,
  required String activeTabId,
  String? savedDockingLayout,
  required bool webViewDebuggingEnabled,
  required TitleChangedCallback onTitleChanged,
  required TabSelectedCallback onTabSelected,
  required TabClosedCallback onTabClosed,
  required VoidCallback onNewTab,
  required VoidCallback onNewTerminal,
  required DockingMenuBuilder onBuildMenu,
  required DockingLayoutChangedCallback onDockingLayoutChanged,
}) {
  if (visibleTabs.isEmpty) return const SizedBox.shrink();
  return SplitLayoutView(
    layout: layout,
    visibleTabs: visibleTabs,
    activeTabId: activeTabId,
    savedDockingLayout: savedDockingLayout,
    webViewDebuggingEnabled: webViewDebuggingEnabled,
    onTitleChanged: onTitleChanged,
    onTabSelected: onTabSelected,
    onTabClosed: onTabClosed,
    onNewTab: onNewTab,
    onNewTerminal: onNewTerminal,
    onBuildMenu: onBuildMenu,
    onDockingLayoutChanged: onDockingLayoutChanged,
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
  String activeTabId,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final areas = children.map((child) {
    if (child is DockingArea) return child;
    return _buildDockingTabs(
      child as List<BrowserTab>,
      activeTabId,
      webViewDebuggingEnabled,
      onTitleChanged,
    );
  }).toList();
  return areas.length == 1 ? areas.first : DockingRow(areas);
}

DockingArea _buildDockingColumn(
  List<dynamic> children,
  String activeTabId,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final areas = children.map((child) {
    if (child is DockingArea) return child;
    return _buildDockingTabs(
      child as List<BrowserTab>,
      activeTabId,
      webViewDebuggingEnabled,
      onTitleChanged,
    );
  }).toList();
  return areas.length == 1 ? areas.first : DockingColumn(areas);
}

DockingArea _buildDockingTabs(
  List<BrowserTab> tabs,
  String activeTabId,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
) {
  final items = tabs
      .map(
        (tab) =>
            _buildDockingItem(tab, webViewDebuggingEnabled, onTitleChanged),
      )
      .toList();

  if (items.length == 1) return items.first;

  final dockingTabs = DockingTabs(items);
  final selectedIndex = tabs.indexWhere((tab) => tab.id == activeTabId);
  if (selectedIndex >= 0) {
    dockingTabs.selectedIndex = selectedIndex;
  }
  return dockingTabs;
}

void _selectDockingItem(DockingLayout layout, String tabId) {
  if (tabId.isEmpty) return;
  final dockingTabs = layout.findDockingTabsWithItem(tabId);
  if (dockingTabs == null) return;
  for (var i = 0; i < dockingTabs.childrenCount; i++) {
    if (dockingTabs.childAt(i).id == tabId) {
      dockingTabs.selectedIndex = i;
      return;
    }
  }
}

DockingItem _buildDockingItem(
  BrowserTab tab,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged, {
  double? weight,
  bool maximized = false,
}) {
  return DockingItem(
    id: tab.id,
    name: tab.title,
    value: tab.id,
    closable: true,
    weight: weight,
    maximized: maximized,
    keepAlive: true,
    leading: (context, status) => _buildTabLeading(context, tab),
    widget: _buildTabPane(tab, webViewDebuggingEnabled, onTitleChanged),
  );
}

String _stringifyLayout(DockingLayout layout) {
  return layout.stringify(parser: _SplitLayoutViewState._layoutParser);
}
