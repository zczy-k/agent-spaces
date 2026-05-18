import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
                'Agent Spaces',
                style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                '连接到 Agent Spaces 服务器',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),
              ActionCard(
                icon: Icons.folder_open,
                title: '打开本地',
                subtitle: _hasLocalWeb ? '加载内置的 Web 前端（无需服务器）' : '未找到本地 Web 资源',
                enabled: _hasLocalWeb,
                onTap: _openLocal,
              ),
              const SizedBox(height: 12),
              ActionCard(
                icon: Icons.link,
                title: '手动输入地址',
                subtitle: '输入服务器地址并设为默认',
                enabled: true,
                onTap: () => _showManualInput(),
              ),
              const SizedBox(height: 12),
              ActionCard(
                icon: Icons.info_outline,
                title: '关于 Agent Spaces',
                subtitle: '版本信息与项目链接',
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
        title: const Text('输入服务器地址'),
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
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('取消')),
          TextButton(onPressed: () => _connectManual(ctx, controller.text), child: const Text('连接')),
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
