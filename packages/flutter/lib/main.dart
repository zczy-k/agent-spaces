import 'dart:async';
import 'dart:io';

import 'package:adaptive_theme/adaptive_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:upgrader/upgrader.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:window_manager/window_manager.dart';
import 'providers/bookmark_provider.dart';
import 'providers/settings_provider.dart';
import 'screens/home_screen.dart';
import 'screens/bookmarks_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/terminal_credentials_screen.dart';
import 'screens/file_source_credentials_screen.dart';
import 'screens/about_screen.dart';
import 'services/notification_service.dart';

final localWebServer = InAppLocalhostServer(
  port: 8080,
  documentRoot: 'assets/web',
);
const _appcastUrl = String.fromEnvironment('APPCAST_URL');
const _windowDefaultSize = Size(1280, 820);
const _windowMinimumSize = Size(960, 640);
final _windowStateController = _WindowStateController();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await NotificationService().initialize();
  await localWebServer.start();
  final savedThemeMode = await AdaptiveTheme.getThemeMode();
  await _configureDesktopWindow(savedThemeMode);
  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('zh'), Locale('en')],
      path: 'assets/translations',
      fallbackLocale: const Locale('zh'),
      useOnlyLangCode: true,
      child: ProviderScope(
        child: AgentSpacesApp(savedThemeMode: savedThemeMode),
      ),
    ),
  );
}

bool get _isDesktopWindowManagerSupported =>
    Platform.isLinux || Platform.isMacOS || Platform.isWindows;

ThemeData _buildAppTheme(Brightness brightness) {
  return ThemeData(
    colorSchemeSeed: const Color(0xFF2563EB),
    useMaterial3: true,
    brightness: brightness,
  );
}

Brightness _initialBrightnessFor(AdaptiveThemeMode? themeMode) {
  return switch (themeMode) {
    AdaptiveThemeMode.dark => Brightness.dark,
    AdaptiveThemeMode.light => Brightness.light,
    AdaptiveThemeMode.system ||
    null => WidgetsBinding.instance.platformDispatcher.platformBrightness,
  };
}

Color _windowChromeColor(ThemeData theme) => theme.colorScheme.surface;

Future<void> _configureDesktopWindow(AdaptiveThemeMode? themeMode) async {
  if (!_isDesktopWindowManagerSupported) {
    return;
  }

  await windowManager.ensureInitialized();
  await windowManager.setPreventClose(true);
  windowManager.addListener(_windowStateController);

  final initialTheme = _buildAppTheme(_initialBrightnessFor(themeMode));
  await windowManager.setBrightness(initialTheme.brightness);
  await windowManager.waitUntilReadyToShow(
    WindowOptions(
      size: _windowDefaultSize,
      minimumSize: _windowMinimumSize,
      center: true,
      backgroundColor: _windowChromeColor(initialTheme),
      skipTaskbar: false,
      title: 'Agent Spaces',
      titleBarStyle: TitleBarStyle.normal,
    ),
  );

  await _windowStateController.restore();
  await windowManager.show();
  await windowManager.focus();
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
    GoRoute(
      path: '/settings/file-source-credentials',
      builder: (context, state) => const FileSourceCredentialsScreen(),
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
      light: _buildAppTheme(Brightness.light),
      dark: _buildAppTheme(Brightness.dark),
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
          return _WindowThemeSync(
            child: UpgradeAlert(
              navigatorKey: _router.routerDelegate.navigatorKey,
              upgrader: _upgrader,
              child: child ?? const SizedBox.shrink(),
            ),
          );
        },
        routerConfig: _router,
      ),
    );
  }
}

class _WindowThemeSync extends StatefulWidget {
  final Widget child;

  const _WindowThemeSync({required this.child});

  @override
  State<_WindowThemeSync> createState() => _WindowThemeSyncState();
}

class _WindowThemeSyncState extends State<_WindowThemeSync>
    with WidgetsBindingObserver {
  Color? _lastChromeColor;
  Brightness? _lastBrightness;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncWindowChromeColor();
  }

  @override
  void didChangePlatformBrightness() {
    super.didChangePlatformBrightness();
    _syncWindowChromeColor();
  }

  void _syncWindowChromeColor() {
    if (!_isDesktopWindowManagerSupported) {
      return;
    }

    final chromeColor = _windowChromeColor(Theme.of(context));
    final brightness = Theme.of(context).brightness;
    if (chromeColor == _lastChromeColor && brightness == _lastBrightness) {
      return;
    }

    _lastChromeColor = chromeColor;
    _lastBrightness = brightness;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(windowManager.setBackgroundColor(chromeColor));
        unawaited(windowManager.setBrightness(brightness));
      }
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _WindowStateController with WindowListener {
  static const _leftKey = 'window.bounds.left';
  static const _topKey = 'window.bounds.top';
  static const _widthKey = 'window.bounds.width';
  static const _heightKey = 'window.bounds.height';
  static const _maximizedKey = 'window.maximized';
  static const _fullscreenKey = 'window.fullscreen';

  Timer? _saveDebounce;
  bool _isClosing = false;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final bounds = _readBounds(prefs);

    if (bounds != null) {
      await windowManager.setBounds(bounds);
    }

    if (prefs.getBool(_maximizedKey) ?? false) {
      await windowManager.maximize();
    }

    if (prefs.getBool(_fullscreenKey) ?? false) {
      await windowManager.setFullScreen(true);
    }
  }

  @override
  void onWindowMoved() {
    _scheduleSave();
  }

  @override
  void onWindowResized() {
    _scheduleSave();
  }

  @override
  void onWindowMaximize() {
    unawaited(_saveWindowState());
  }

  @override
  void onWindowUnmaximize() {
    _scheduleSave();
  }

  @override
  void onWindowEnterFullScreen() {
    unawaited(_saveWindowState());
  }

  @override
  void onWindowLeaveFullScreen() {
    _scheduleSave();
  }

  @override
  void onWindowClose() {
    unawaited(_closeAfterSave());
  }

  void _scheduleSave() {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 300), () {
      unawaited(_saveWindowState());
    });
  }

  Future<void> _saveWindowState() async {
    final isMinimized = await windowManager.isMinimized();
    if (isMinimized) {
      return;
    }

    final isMaximized = await windowManager.isMaximized();
    final isFullScreen = await windowManager.isFullScreen();
    final prefs = await SharedPreferences.getInstance();

    await prefs.setBool(_maximizedKey, isMaximized);
    await prefs.setBool(_fullscreenKey, isFullScreen);

    if (isMaximized || isFullScreen) {
      return;
    }

    final bounds = await windowManager.getBounds();
    if (bounds.width < _windowMinimumSize.width ||
        bounds.height < _windowMinimumSize.height) {
      return;
    }

    await prefs.setDouble(_leftKey, bounds.left);
    await prefs.setDouble(_topKey, bounds.top);
    await prefs.setDouble(_widthKey, bounds.width);
    await prefs.setDouble(_heightKey, bounds.height);
  }

  Future<void> _closeAfterSave() async {
    if (_isClosing) {
      return;
    }

    _isClosing = true;
    _saveDebounce?.cancel();
    await _saveWindowState();
    await windowManager.destroy();
  }

  Rect? _readBounds(SharedPreferences prefs) {
    final left = prefs.getDouble(_leftKey);
    final top = prefs.getDouble(_topKey);
    final width = prefs.getDouble(_widthKey);
    final height = prefs.getDouble(_heightKey);

    if (left == null || top == null || width == null || height == null) {
      return null;
    }

    if (width < _windowMinimumSize.width ||
        height < _windowMinimumSize.height) {
      return null;
    }

    return Rect.fromLTWH(left, top, width, height);
  }
}
