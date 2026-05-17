import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/browser_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/browser_tab_bar.dart';
import '../widgets/webview_panel.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    if (_initialized) return;
    _initialized = true;

    final settings = ref.read(settingsProvider);
    final notifier = ref.read(browserProvider.notifier);
    notifier.setRestoreOnStartup(settings.restoreTabsOnStartup);
    await notifier.init();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          const BrowserTabBar(),
          const Expanded(child: WebViewPanel()),
        ],
      ),
    );
  }
}
