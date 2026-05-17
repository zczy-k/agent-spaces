import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../models/browser_tab.dart';

class BrowserState {
  final List<BrowserTab> tabs;
  final String activeTabId;
  final String homeUrl;

  const BrowserState({
    this.tabs = const [],
    this.activeTabId = '',
    this.homeUrl = 'http://localhost:3000',
  });

  BrowserTab? get activeTab {
    try {
      return tabs.firstWhere((t) => t.id == activeTabId);
    } catch (_) {
      return null;
    }
  }

  BrowserState copyWith({
    List<BrowserTab>? tabs,
    String? activeTabId,
    String? homeUrl,
  }) {
    return BrowserState(
      tabs: tabs ?? this.tabs,
      activeTabId: activeTabId ?? this.activeTabId,
      homeUrl: homeUrl ?? this.homeUrl,
    );
  }
}

class BrowserNotifier extends StateNotifier<BrowserState> {
  static const _uuid = Uuid();

  BrowserNotifier() : super(const BrowserState()) {
    _addInitialTab();
  }

  void _addInitialTab() {
    final tab = BrowserTab(
      id: _uuid.v4(),
      title: 'Agent Spaces',
      url: state.homeUrl,
    );
    state = state.copyWith(tabs: [tab], activeTabId: tab.id);
  }

  void addTab({String? url, String? title}) {
    final tab = BrowserTab(
      id: _uuid.v4(),
      title: title ?? 'New Tab',
      url: url ?? state.homeUrl,
    );
    state = state.copyWith(
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    );
  }

  void closeTab(String tabId) {
    if (state.tabs.length <= 1) return;
    final idx = state.tabs.indexWhere((t) => t.id == tabId);
    final newTabs = state.tabs.where((t) => t.id != tabId).toList();
    String newActiveId = state.activeTabId;
    if (state.activeTabId == tabId) {
      final newIdx = idx < newTabs.length ? idx : newTabs.length - 1;
      newActiveId = newTabs[newIdx].id;
    }
    state = state.copyWith(tabs: newTabs, activeTabId: newActiveId);
  }

  void setActiveTab(String tabId) {
    state = state.copyWith(activeTabId: tabId);
  }

  void updateTab(String tabId, {String? title, String? url}) {
    state = state.copyWith(
      tabs: state.tabs
          .map((t) => t.id == tabId ? t.copyWith(title: title, url: url) : t)
          .toList(),
    );
  }

  void setDevice(DeviceProfile device, String tabId) {
    state = state.copyWith(
      tabs: state.tabs
          .map((t) => t.id == tabId ? t.copyWith(device: device) : t)
          .toList(),
    );
  }

  void setHomeUrl(String url) {
    state = state.copyWith(homeUrl: url);
  }
}

final browserProvider =
    StateNotifierProvider<BrowserNotifier, BrowserState>((ref) {
  return BrowserNotifier();
});
