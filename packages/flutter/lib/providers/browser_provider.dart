import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/browser_tab.dart';
import '../services/storage_service.dart';

enum SplitLayout { single, horizontal2, vertical2, horizontal3, quad }

class BrowserState {
  final List<BrowserTab> tabs;
  final String activeTabId;
  final String homeUrl;
  final SplitLayout splitLayout;
  final String? savedDockingLayout;

  const BrowserState({
    this.tabs = const [],
    this.activeTabId = '',
    this.homeUrl = 'http://localhost:3000',
    this.splitLayout = SplitLayout.single,
    this.savedDockingLayout,
  });

  BrowserTab? get activeTab {
    try {
      return tabs.firstWhere((t) => t.id == activeTabId);
    } catch (_) {
      return null;
    }
  }

  int get splitCount => switch (splitLayout) {
    SplitLayout.single => 1,
    SplitLayout.horizontal2 => 2,
    SplitLayout.vertical2 => 2,
    SplitLayout.horizontal3 => 3,
    SplitLayout.quad => 4,
  };

  List<BrowserTab> get visibleTabs {
    if (tabs.isEmpty) return const [];
    if (splitLayout == SplitLayout.single) {
      final idx = tabs.indexWhere((t) => t.id == activeTabId);
      return [tabs[idx >= 0 ? idx : 0]];
    }
    final activeIdx = tabs
        .indexWhere((t) => t.id == activeTabId)
        .clamp(0, tabs.length - 1);
    final orderedTabs = [...tabs.skip(activeIdx), ...tabs.take(activeIdx)];
    return orderedTabs.take(splitCount).toList(growable: false);
  }

  BrowserState copyWith({
    List<BrowserTab>? tabs,
    String? activeTabId,
    String? homeUrl,
    SplitLayout? splitLayout,
    String? savedDockingLayout,
  }) {
    return BrowserState(
      tabs: tabs ?? this.tabs,
      activeTabId: activeTabId ?? this.activeTabId,
      homeUrl: homeUrl ?? this.homeUrl,
      splitLayout: splitLayout ?? this.splitLayout,
      savedDockingLayout: savedDockingLayout ?? this.savedDockingLayout,
    );
  }
}

class BrowserNotifier extends StateNotifier<BrowserState> {
  static const _uuid = Uuid();
  bool _restoreOnStartup = false;
  bool _restoreLayoutOnStartup = true;

  BrowserNotifier() : super(const BrowserState());

  Future<void> init() async {
    final savedHomeUrl = await StorageService.loadHomeUrl();
    if (savedHomeUrl != null) {
      state = state.copyWith(homeUrl: savedHomeUrl);
    }

    if (_restoreLayoutOnStartup) {
      final savedLayout = await StorageService.loadSplitLayout();
      final splitLayout = _parseSplitLayout(savedLayout);
      final savedDockingLayout = await StorageService.loadDockingLayout();
      if (splitLayout != null) {
        state = state.copyWith(splitLayout: splitLayout);
      }
      if (savedDockingLayout != null) {
        state = state.copyWith(savedDockingLayout: savedDockingLayout);
      }
    }

    if (_restoreOnStartup) {
      final savedTabs = await StorageService.loadTabs();
      final savedActiveId = await StorageService.loadActiveTabId();
      if (savedTabs.isNotEmpty) {
        state = state.copyWith(
          tabs: savedTabs,
          activeTabId: savedActiveId ?? savedTabs.first.id,
        );
        return;
      }
    }
    // Don't auto-create tab - show homepage instead
  }

  void setRestoreOnStartup(bool value) => _restoreOnStartup = value;

  void setRestoreLayoutOnStartup(bool value) => _restoreLayoutOnStartup = value;

  void addTab({String? url, String? title, DeviceProfile? device}) {
    final tab = BrowserTab(
      id: _uuid.v4(),
      title: title ?? 'New Tab',
      url: url ?? state.homeUrl,
      device: device ?? DeviceProfile.desktop,
    );
    state = state.copyWith(tabs: [...state.tabs, tab], activeTabId: tab.id);
    _persistTabs();
  }

  void addTerminalTab() {
    final tab = BrowserTab(
      id: _uuid.v4(),
      title: 'Terminal',
      url: 'terminal://new',
      type: BrowserTabType.terminal,
    );
    state = state.copyWith(tabs: [...state.tabs, tab], activeTabId: tab.id);
    _persistTabs();
  }

  void closeTab(String tabId) {
    final newTabs = state.tabs.where((t) => t.id != tabId).toList();
    String newActiveId = '';
    if (newTabs.isNotEmpty) {
      final idx = state.tabs.indexWhere((t) => t.id == tabId);
      final newIdx = idx < newTabs.length ? idx : newTabs.length - 1;
      newActiveId = newTabs[newIdx].id;
    }
    state = state.copyWith(tabs: newTabs, activeTabId: newActiveId);
    _persistTabs();
  }

  void setActiveTab(String tabId) {
    if (state.activeTabId == tabId) return;
    state = state.copyWith(activeTabId: tabId);
    _persistTabs();
  }

  void updateTab(
    String tabId, {
    String? title,
    String? url,
    String? faviconUrl,
  }) {
    var changed = false;
    final tabs = state.tabs.map((t) {
      if (t.id != tabId) return t;
      final nextTitle = title ?? t.title;
      final nextUrl = url ?? t.url;
      final nextFaviconUrl = faviconUrl ?? t.faviconUrl;
      if (nextTitle == t.title &&
          nextUrl == t.url &&
          nextFaviconUrl == t.faviconUrl) {
        return t;
      }
      changed = true;
      return t.copyWith(title: title, url: url, faviconUrl: faviconUrl);
    }).toList();
    if (!changed) return;
    state = state.copyWith(tabs: tabs);
    _persistTabs();
  }

  void setDevice(DeviceProfile device, String tabId) {
    state = state.copyWith(
      tabs: state.tabs
          .map((t) => t.id == tabId ? t.copyWith(device: device) : t)
          .toList(),
    );
    _persistTabs();
  }

  void setHomeUrl(String url) {
    state = state.copyWith(homeUrl: url);
    StorageService.saveHomeUrl(url);
  }

  void setSplitLayout(SplitLayout layout) {
    state = state.copyWith(splitLayout: layout);
    StorageService.saveSplitLayout(layout.name);
  }

  void saveDockingLayout(String layout) {
    StorageService.saveDockingLayout(layout);
  }

  void _persistTabs() {
    StorageService.saveTabs(state.tabs, state.activeTabId);
  }

  SplitLayout? _parseSplitLayout(String? name) {
    if (name == null) return null;
    for (final layout in SplitLayout.values) {
      if (layout.name == name) return layout;
    }
    return null;
  }
}

final browserProvider = StateNotifierProvider<BrowserNotifier, BrowserState>((
  ref,
) {
  return BrowserNotifier();
});
