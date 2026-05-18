import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:upgrader/upgrader.dart';
import 'providers/bookmark_provider.dart';
import 'providers/settings_provider.dart';
import 'screens/home_screen.dart';
import 'screens/bookmarks_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/about_screen.dart';
import 'services/notification_service.dart';

final localWebServer = InAppLocalhostServer(port: 8080, documentRoot: 'assets/web');
const _appcastUrl = String.fromEnvironment('APPCAST_URL');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().initialize();
  await localWebServer.start();
  runApp(const ProviderScope(child: AgentSpacesApp()));
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
      path: '/about',
      builder: (context, state) => const AboutScreen(),
    ),
  ],
);

final _upgrader = Upgrader(
  storeController: _appcastUrl.isEmpty
      ? UpgraderStoreController()
      : UpgraderStoreController(
          onAndroid: () => UpgraderAppcastStore(
            appcastURL: _appcastUrl,
            osVersion: '0.0.0',
          ),
          oniOS: () => UpgraderAppcastStore(
            appcastURL: _appcastUrl,
            osVersion: '0.0.0',
          ),
          onMacOS: () => UpgraderAppcastStore(
            appcastURL: _appcastUrl,
            osVersion: '0.0.0',
          ),
          onWindows: () => UpgraderAppcastStore(
            appcastURL: _appcastUrl,
            osVersion: '0.0.0',
          ),
        ),
);

class AgentSpacesApp extends ConsumerWidget {
  const AgentSpacesApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Initialize providers
    ref.watch(bookmarkProvider);
    ref.watch(settingsProvider);

    return MaterialApp.router(
      title: 'Agent Spaces',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF2563EB),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      builder: (context, child) {
        return UpgradeAlert(
          navigatorKey: _router.routerDelegate.navigatorKey,
          upgrader: _upgrader,
          child: child ?? const SizedBox.shrink(),
        );
      },
      routerConfig: _router,
    );
  }
}
