import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/bookmark.dart';
import '../services/storage_service.dart';

class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier() : super(const AppSettings());

  Future<void> init() async {
    state = await StorageService.loadSettings();
  }

  void load(AppSettings s) => state = s;

  void setRestoreTabsOnStartup(bool value) {
    state = state.copyWith(restoreTabsOnStartup: value);
    StorageService.saveSettings(state);
  }

  void setWebViewDebuggingEnabled(bool value) {
    state = state.copyWith(webViewDebuggingEnabled: value);
    StorageService.saveSettings(state);
  }

  void setIncognito(bool value) {
    state = state.copyWith(incognito: value);
    StorageService.saveSettings(state);
  }
}

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>((
  ref,
) {
  final notifier = SettingsNotifier();
  notifier.init();
  return notifier;
});
