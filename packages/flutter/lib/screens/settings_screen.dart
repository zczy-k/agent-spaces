import 'package:adaptive_theme/adaptive_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../providers/settings_provider.dart';
import '../services/notification_service.dart';
import '../services/webview_service.dart';

final _notificationService = NotificationService();

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _notificationAllowed = false;
  bool _loadingNotificationPermission = true;
  bool _requestingNotificationPermission = false;
  bool _clearingCache = false;

  @override
  void initState() {
    super.initState();
    _refreshNotificationPermission();
  }

  Future<void> _refreshNotificationPermission() async {
    final allowed = await _notificationService.isAllowed();
    if (!mounted) return;
    setState(() {
      _notificationAllowed = allowed;
      _loadingNotificationPermission = false;
    });
  }

  Future<void> _requestNotificationPermission() async {
    setState(() {
      _requestingNotificationPermission = true;
    });
    final allowed = await _notificationService.requestPermission();
    if (!mounted) return;
    setState(() {
      _notificationAllowed = allowed;
      _requestingNotificationPermission = false;
      _loadingNotificationPermission = false;
    });
  }

  Future<void> _clearBrowserCache() async {
    setState(() => _clearingCache = true);
    await WebViewService.instance.clearAllCache();
    if (!mounted) return;
    setState(() => _clearingCache = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('settings_cache_cleared'.tr()),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('settings'.tr(), style: const TextStyle(fontSize: 16)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        children: [
          _SectionHeader(title: 'settings_startup'.tr()),
          SwitchListTile(
            dense: true,
            secondary: const Icon(Icons.restore, size: 20),
            title: Text(
              'settings_restore_tabs'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_restore_tabs_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            value: settings.restoreTabsOnStartup,
            onChanged: (v) => notifier.setRestoreTabsOnStartup(v),
          ),
          SwitchListTile(
            dense: true,
            secondary: const Icon(Icons.dashboard_customize_outlined, size: 20),
            title: Text(
              'settings_restore_layout'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_restore_layout_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            value: settings.restoreLayoutOnStartup,
            onChanged: (v) => notifier.setRestoreLayoutOnStartup(v),
          ),
          _SectionHeader(title: 'settings_auth'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.notifications_outlined, size: 20),
            title: Text(
              'settings_notification'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              _loadingNotificationPermission
                  ? 'settings_notification_checking'.tr()
                  : (_notificationAllowed
                        ? 'settings_notification_allowed'.tr()
                        : 'settings_notification_denied'.tr()),
              style: TextStyle(
                fontSize: 11,
                color: _notificationAllowed
                    ? Colors.teal
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: _notificationAllowed
                ? Icon(
                    Icons.check_circle,
                    size: 20,
                    color: theme.colorScheme.primary,
                  )
                : TextButton(
                    onPressed: _requestingNotificationPermission
                        ? null
                        : _requestNotificationPermission,
                    child: Text(
                      _requestingNotificationPermission
                          ? 'settings_notification_authorizing'.tr()
                          : 'settings_notification_authorize'.tr(),
                    ),
                  ),
          ),
          _SectionHeader(title: 'settings_browser'.tr()),
          SwitchListTile(
            dense: true,
            secondary: const Icon(Icons.bug_report_outlined, size: 20),
            title: Text(
              'settings_webview_debug'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_webview_debug_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            value: settings.webViewDebuggingEnabled,
            onChanged: (v) async {
              notifier.setWebViewDebuggingEnabled(v);
              await WebViewService.instance.setDebuggingEnabled(v);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    v
                        ? 'settings_webview_debug_enabled'.tr()
                        : 'settings_webview_debug_disabled'.tr(),
                  ),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
          ),
          SwitchListTile(
            dense: true,
            secondary: const Icon(Icons.visibility_off_outlined, size: 20),
            title: Text(
              'settings_incognito'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_incognito_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            value: settings.incognito,
            onChanged: (v) {
              notifier.setIncognito(v);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    v
                        ? 'settings_incognito_enabled'.tr()
                        : 'settings_incognito_disabled'.tr(),
                  ),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.cleaning_services_outlined, size: 20),
            title: Text(
              'settings_clear_cache'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_clear_cache_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: _clearingCache
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.chevron_right, size: 20),
            onTap: _clearingCache ? null : _clearBrowserCache,
          ),
          _SectionHeader(title: 'settings_terminal'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.key_outlined, size: 20),
            title: Text(
              'settings_terminal_credentials'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_terminal_credentials_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: const Icon(Icons.chevron_right, size: 20),
            onTap: () => context.push('/settings/terminal-credentials'),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.folder_outlined, size: 20),
            title: Text(
              'settings_file_source_credentials'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_file_source_credentials_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: const Icon(Icons.chevron_right, size: 20),
            onTap: () => context.push('/settings/file-source-credentials'),
          ),
          _SectionHeader(title: 'settings_language'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.language, size: 20),
            title: Text(
              'settings_language'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              'settings_language_desc'.tr(),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.locale.languageCode == 'zh'
                      ? 'language_zh'.tr()
                      : 'language_en'.tr(),
                  style: TextStyle(
                    fontSize: 13,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 20),
              ],
            ),
            onTap: () => _showLanguageDialog(context),
          ),
          _SectionHeader(title: 'settings_appearance'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.dark_mode_outlined, size: 20),
            title: Text(
              'settings_theme'.tr(),
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              _themeLabel(AdaptiveTheme.of(context).mode),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            trailing: const Icon(Icons.chevron_right, size: 20),
            onTap: () => _showThemeDialog(context),
          ),
          _SectionHeader(title: 'settings_other'.tr()),
          ListTile(
            dense: true,
            leading: const Icon(Icons.info_outline, size: 20),
            title: Text('about'.tr(), style: const TextStyle(fontSize: 13)),
            subtitle: Text(
              'settings_version'.tr(args: ['0.1.0']),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            onTap: () => context.push('/about'),
          ),
        ],
      ),
    );
  }

  void _showLanguageDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text('settings_language'.tr()),
        children: [
          SimpleDialogOption(
            onPressed: () {
              context.setLocale(const Locale('zh'));
              Navigator.of(ctx).pop();
            },
            child: Row(
              children: [
                Text('language_zh'.tr(), style: const TextStyle(fontSize: 14)),
                const Spacer(),
                if (context.locale.languageCode == 'zh')
                  Icon(
                    Icons.check,
                    size: 18,
                    color: Theme.of(context).colorScheme.primary,
                  ),
              ],
            ),
          ),
          SimpleDialogOption(
            onPressed: () {
              context.setLocale(const Locale('en'));
              Navigator.of(ctx).pop();
            },
            child: Row(
              children: [
                Text('language_en'.tr(), style: const TextStyle(fontSize: 14)),
                const Spacer(),
                if (context.locale.languageCode == 'en')
                  Icon(
                    Icons.check,
                    size: 18,
                    color: Theme.of(context).colorScheme.primary,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _themeLabel(AdaptiveThemeMode mode) {
    return switch (mode) {
      AdaptiveThemeMode.light => 'settings_theme_light'.tr(),
      AdaptiveThemeMode.dark => 'settings_theme_dark'.tr(),
      AdaptiveThemeMode.system => 'settings_theme_system'.tr(),
    };
  }

  void _showThemeDialog(BuildContext context) {
    final current = AdaptiveTheme.of(context).mode;
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: Text('settings_theme'.tr()),
        children: AdaptiveThemeMode.values.map((mode) {
          return SimpleDialogOption(
            onPressed: () {
              AdaptiveTheme.of(context).setThemeMode(mode);
              Navigator.of(ctx).pop();
            },
            child: Row(
              children: [
                Text(_themeLabel(mode), style: const TextStyle(fontSize: 14)),
                const Spacer(),
                if (mode == current)
                  Icon(
                    Icons.check,
                    size: 18,
                    color: Theme.of(context).colorScheme.primary,
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
