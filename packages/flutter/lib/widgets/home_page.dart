import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import 'home_cards.dart';

class HomePage extends StatefulWidget {
  final void Function(String url) onServerFound;
  final String homeUrl;

  const HomePage({super.key, required this.onServerFound, required this.homeUrl});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _hasLocalWeb = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkLocalWeb());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.hub, size: 56, color: theme.colorScheme.primary),
              const SizedBox(height: 16),
              Text(
                'app_name'.tr(),
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'home_connect_to_server'.tr(),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),
              ActionCard(
                icon: Icons.folder_open,
                title: 'home_open_local'.tr(),
                subtitle: _hasLocalWeb ? 'home_open_local_desc'.tr() : 'home_open_local_not_found'.tr(),
                enabled: _hasLocalWeb,
                onTap: _openLocal,
              ),
              const SizedBox(height: 12),
              ActionCard(
                icon: Icons.link,
                title: 'home_manual_input'.tr(),
                subtitle: 'home_manual_input_desc'.tr(),
                enabled: true,
                onTap: () => _showManualInput(),
              ),
              const SizedBox(height: 12),
              ActionCard(
                icon: Icons.info_outline,
                title: 'home_about'.tr(),
                subtitle: 'home_about_desc'.tr(),
                enabled: true,
                onTap: () => context.push('/about'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _checkLocalWeb() async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(milliseconds: 500);
      final request = await client.getUrl(Uri.parse('http://localhost:8080/index.html'));
      final response = await request.close();
      client.close();
      if (response.statusCode == 200 && mounted) {
        setState(() => _hasLocalWeb = true);
      }
    } catch (_) {}
  }

  void _openLocal() {
    widget.onServerFound('http://localhost:8080/index.html');
  }

  void _showManualInput() {
    final controller = TextEditingController(text: widget.homeUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('home_enter_server_address'.tr()),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'http://192.168.1.100:3000',
            prefixIcon: Icon(Icons.link, size: 18),
          ),
          onSubmitted: (v) => _connectManual(ctx, v),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text('cancel'.tr())),
          TextButton(onPressed: () => _connectManual(ctx, controller.text), child: Text('home_connect'.tr())),
        ],
      ),
    );
  }

  void _connectManual(BuildContext ctx, String raw) {
    if (raw.isEmpty) return;
    final url = raw.startsWith('http') ? raw : 'http://$raw';
    Navigator.of(ctx).pop();
    widget.onServerFound(url);
  }
}
