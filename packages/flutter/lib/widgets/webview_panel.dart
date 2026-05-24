import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/browser_provider.dart';
import '../providers/settings_provider.dart';
import 'home_page.dart';
import 'split_layout.dart';
import 'tab_dialogs.dart';
import 'tab_widgets.dart';

class WebViewPanel extends ConsumerStatefulWidget {
  const WebViewPanel({super.key});

  @override
  ConsumerState<WebViewPanel> createState() => _WebViewPanelState();
}

class _WebViewPanelState extends ConsumerState<WebViewPanel> {
  bool _frontendAvailable = false;
  bool _backendAvailable = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkServers());
  }

  Future<void> _checkServers() async {
    final results = await Future.wait([
      _checkUrl('http://127.0.0.1:3000'),
      _checkHealth('127.0.0.1', 3100),
    ]);
    if (!mounted) return;
    setState(() {
      _frontendAvailable = results[0];
      _backendAvailable = results[1];
    });
  }

  Future<bool> _checkUrl(String url) async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 2);
      final request = await client.getUrl(Uri.parse(url));
      final response = await request.close();
      client.close();
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _checkHealth(String host, int port) async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 2);
      final request = await client.getUrl(
        Uri.parse('http://$host:$port/api/health'),
      );
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      client.close();
      return response.statusCode == 200 && body.contains('"status":"ok"');
    } catch (_) {
      return false;
    }
  }

  void _openServer(String url) {
    ref.read(browserProvider.notifier).setHomeUrl(url);
    ref.read(browserProvider.notifier).addTab(url: url, title: 'Agent Spaces');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(browserProvider);
    final notifier = ref.read(browserProvider.notifier);
    final webViewDebuggingEnabled = ref.watch(
      settingsProvider.select((settings) => settings.webViewDebuggingEnabled),
    );

    Widget child;
    if (state.tabs.isEmpty) {
      child = HomePage(onServerFound: _openServer, homeUrl: state.homeUrl);
    } else {
      child = buildSplitLayout(
        context: context,
        layout: state.splitLayout,
        visibleTabs: state.splitLayout == SplitLayout.single
            ? state.tabs
            : state.visibleTabs,
        activeTabId: state.activeTabId,
        savedDockingLayout: state.savedDockingLayout,
        webViewDebuggingEnabled: webViewDebuggingEnabled,
        onTitleChanged: (tabId, title, url, faviconUrl) {
          notifier.updateTab(
            tabId,
            title: title,
            url: url,
            faviconUrl: faviconUrl,
          );
        },
        onTabSelected: notifier.setActiveTab,
        onTabClosed: notifier.closeTab,
        onNewTab: () => showNewTabDialog(context, notifier),
        onNewTerminal: notifier.addTerminalTab,
        onDockingLayoutChanged: notifier.saveDockingLayout,
        onBuildMenu: (menuContext) => buildBrowserMenuItems(
          menuContext,
          ref,
          activeTabId: state.activeTabId,
          onNewTab: () => showNewTabDialog(context, notifier),
          onNewTerminal: notifier.addTerminalTab,
          onNewFileSource: notifier.addFileSourceTab,
        ),
      );
    }

    final showBadges =
        state.tabs.isEmpty && (_frontendAvailable || _backendAvailable);
    if (!showBadges) return child;

    return Stack(
      children: [
        child,
        Positioned(
          top: 8,
          left: 8,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_backendAvailable)
                _ServerBadge(
                  label: '后端服务器',
                  color: Theme.of(context).colorScheme.primary,
                  onTap: () => _openServer('http://127.0.0.1:3100'),
                ),
              if (_frontendAvailable) ...[
                const SizedBox(width: 6),
                _ServerBadge(
                  label: '前端服务器',
                  color: Theme.of(context).colorScheme.tertiary,
                  onTap: () => _openServer('http://127.0.0.1:3000'),
                ),
              ],
            ],
          ),
        ),
        if (_backendAvailable || _frontendAvailable)
          Positioned(
            top: 8,
            right: 8,
            child: _ServerMenuButton(
              menuItems: buildBrowserMenuItems(
                context,
                ref,
                activeTabId: null,
                onNewTab: () => showNewTabDialog(context, notifier),
                onNewTerminal: notifier.addTerminalTab,
                onNewFileSource: notifier.addFileSourceTab,
              ),
            ),
          ),
      ],
    );
  }
}

class _ServerMenuButton extends StatelessWidget {
  final List<PopupMenuEntry<VoidCallback>> menuItems;

  const _ServerMenuButton({required this.menuItems});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(8),
      elevation: 1,
      child: InkWell(
        onTap: () {
          final renderBox = context.findRenderObject() as RenderBox;
          final overlay =
              Overlay.of(context).context.findRenderObject() as RenderBox;
          final offset =
              renderBox.localToGlobal(Offset.zero, ancestor: overlay);
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
            items: menuItems,
          ).then((action) => action?.call());
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(Icons.more_vert,
              size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ),
    );
  }
}

class _ServerBadge extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ServerBadge({
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(8),
      elevation: 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, size: 8, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
