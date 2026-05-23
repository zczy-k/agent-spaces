import 'package:adaptive_theme/adaptive_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:upgrader/upgrader.dart';
import 'package:easy_localization/easy_localization.dart';
import 'providers/bookmark_provider.dart';
import 'providers/settings_provider.dart';
import 'screens/home_screen.dart';
import 'screens/bookmarks_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/terminal_credentials_screen.dart';
import 'screens/about_screen.dart';
import 'services/notification_service.dart';

final localWebServer = InAppLocalhostServer(
  port: 8080,
  documentRoot: 'assets/web',
);
const _appcastUrl = String.fromEnvironment('APPCAST_URL');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await NotificationService().initialize();
  await localWebServer.start(); 
  final savedThemeMode = await AdaptiveTheme.getThemeMode();
  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('zh'), Locale('en')],
      path: 'assets/translations',
      fallbackLocale: const Locale('zh'),
      useOnlyLangCode: true,
      child: ProviderScope(child: AgentSpacesApp(savedThemeMode: savedThemeMode)),
    ),
  );
}

final _router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
    GoRoute(
      path: '/bookmarks',
      builder: (context, state) => const BookmarksScreen(),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      path: '/settings/terminal-credentials',
      builder: (context, state) => const TerminalCredentialsScreen(),
    ),
    GoRoute(path: '/about', builder: (context, state) => const AboutScreen()),
  ],
);

final _upgrader = Upgrader(
  storeController: _appcastUrl.isEmpty
      ? UpgraderStoreController()
      : UpgraderStoreController(
          onAndroid: () =>
              UpgraderAppcastStore(appcastURL: _appcastUrl, osVersion: '0.0.0'),
          oniOS: () =>
              UpgraderAppcastStore(appcastURL: _appcastUrl, osVersion: '0.0.0'),
          onMacOS: () =>
              UpgraderAppcastStore(appcastURL: _appcastUrl, osVersion: '0.0.0'),
          onWindows: () =>
              UpgraderAppcastStore(appcastURL: _appcastUrl, osVersion: '0.0.0'),
        ),
);

class AgentSpacesApp extends ConsumerWidget {
  final AdaptiveThemeMode? savedThemeMode;
  const AgentSpacesApp({super.key, this.savedThemeMode});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Initialize providers
    ref.watch(bookmarkProvider);
    ref.watch(settingsProvider);

    return AdaptiveTheme(
      light: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      dark: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      initial: savedThemeMode ?? AdaptiveThemeMode.light,
      builder: (theme, darkTheme) => MaterialApp.router(
        title: 'Agent Spaces',
        debugShowCheckedModeBanner: false,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        theme: theme,
        darkTheme: darkTheme,
        builder: (context, child) {
          return UpgradeAlert(
            navigatorKey: _router.routerDelegate.navigatorKey,
            upgrader: _upgrader,
            child: child ?? const SizedBox.shrink(),
          );
        },
        routerConfig: _router,
      ),
    );
  }
}
