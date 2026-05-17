import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/browser_provider.dart';
import '../services/notification_service.dart';
import '../widgets/browser_tab_bar.dart';
import '../widgets/device_selector.dart';
import '../widgets/webview_panel.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    _initNotifications();
  }

  Future<void> _initNotifications() async {
    final svc = NotificationService();
    await svc.initialize();
    await svc.requestPermission();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // Toolbar
          Container(
            height: 40,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(
                bottom: BorderSide(
                  color: Theme.of(context).dividerColor,
                ),
              ),
            ),
            child: Row(
              children: [
                const SizedBox(width: 8),
                // URL bar
                Expanded(
                  child: _UrlBar(),
                ),
                const SizedBox(width: 8),
                const DeviceSelector(),
                const SizedBox(width: 8),
              ],
            ),
          ),
          // Tab bar
          const BrowserTabBar(),
          // WebView content
          const Expanded(child: WebViewPanel()),
        ],
      ),
    );
  }
}

class _UrlBar extends ConsumerStatefulWidget {
  @override
  ConsumerState<_UrlBar> createState() => _UrlBarState();
}

class _UrlBarState extends ConsumerState<_UrlBar> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeTab = ref.watch(browserProvider).activeTab;
    _controller.text = activeTab?.url ?? '';

    return TextField(
      controller: _controller,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        prefixIcon: const Icon(Icons.language, size: 16),
      ),
      onSubmitted: (url) {
        if (url.isEmpty) return;
        final normalized = url.startsWith('http') ? url : 'http://$url';
        if (activeTab != null) {
          ref.read(browserProvider.notifier).updateTab(
                activeTab.id,
                url: normalized,
              );
        }
      },
    );
  }
}
