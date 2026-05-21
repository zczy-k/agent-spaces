import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import '../providers/settings_provider.dart';
import '../services/webview_service.dart';
import 'debug_widgets.dart';
import 'console_sheet.dart';

IconData deviceIcon(DeviceType type) {
  return switch (type) {
    DeviceType.phone => Icons.phone_android,
    DeviceType.tablet => Icons.tablet,
    DeviceType.desktop => Icons.desktop_windows,
  };
}

void showNewTabDialog(BuildContext context, BrowserNotifier notifier) {
  final controller = TextEditingController();
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('新建标签页', style: TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(fontSize: 13),
        decoration: const InputDecoration(isDense: true, hintText: '输入 URL'),
        onSubmitted: (url) {
          if (url.isNotEmpty) {
            final normalized = url.startsWith('http') ? url : 'http://$url';
            notifier.addTab(url: normalized);
            Navigator.of(ctx).pop();
          }
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            final url = controller.text;
            if (url.isNotEmpty) {
              final normalized = url.startsWith('http') ? url : 'http://$url';
              notifier.addTab(url: normalized);
              Navigator.of(ctx).pop();
            }
          },
          child: const Text('打开'),
        ),
      ],
    ),
  );
}

void showNavigateDialog(
  BuildContext context,
  BrowserTab tab,
  BrowserNotifier notifier,
) {
  final controller = TextEditingController(text: tab.url);
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('跳转', style: TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(fontSize: 13),
        decoration: const InputDecoration(
          isDense: true,
          hintText: '输入 URL',
          prefixIcon: Icon(Icons.language, size: 16),
        ),
        onSubmitted: (url) {
          if (url.isNotEmpty) {
            final normalized = url.startsWith('http') ? url : 'http://$url';
            notifier.updateTab(tab.id, url: normalized);
            WebViewService.instance.loadUrl(tab.id, normalized);
            Navigator.of(ctx).pop();
          }
        },
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            if (controller.text.isNotEmpty) {
              final normalized = controller.text.startsWith('http')
                  ? controller.text
                  : 'http://${controller.text}';
              notifier.updateTab(tab.id, url: normalized);
              WebViewService.instance.loadUrl(tab.id, normalized);
              Navigator.of(ctx).pop();
            }
          },
          child: const Text('跳转'),
        ),
      ],
    ),
  );
}

void showDeviceMenu(
  BuildContext context,
  BrowserTab tab,
  BrowserNotifier notifier,
) {
  showDialog(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: const Text('切换设备', style: TextStyle(fontSize: 15)),
      children: DeviceProfile.defaults.map((d) {
        final selected = d.type == tab.device.type;
        return SimpleDialogOption(
          onPressed: () {
            notifier.setDevice(d, tab.id);
            Navigator.of(ctx).pop();
          },
          child: Row(
            children: [
              Icon(deviceIcon(d.type), size: 18),
              const SizedBox(width: 12),
              Text(
                '${d.name} (${d.width.toInt()}x${d.height.toInt()})',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
              if (selected) ...[
                const Spacer(),
                Icon(
                  Icons.check,
                  size: 16,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ],
            ],
          ),
        );
      }).toList(),
    ),
  );
}

void showDebugDialog(BuildContext context, WidgetRef ref, BrowserTab tab) {
  final theme = Theme.of(context);
  final webViewDebuggingEnabled = ref.read(
    settingsProvider.select((settings) => settings.webViewDebuggingEnabled),
  );
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('调试', style: TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DebugInfoRow(label: '标签页', value: tab.title),
              const SizedBox(height: 8),
              DebugInfoRow(label: 'URL', value: tab.url),
              const SizedBox(height: 8),
              DebugInfoRow(
                label: '设备',
                value:
                    '${tab.device.name} '
                    '${tab.device.width.toInt()}x'
                    '${tab.device.height.toInt()}',
              ),
              const SizedBox(height: 12),
              Text(
                webViewDebuggingEnabled
                    ? 'WebView inspectable 已启用。'
                    : 'WebView inspectable 当前未启用，可在"设置 > 浏览器 > WebView 调试"中打开。',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              const DebugStepsSection(
                title: 'macOS Safari',
                steps: [
                  'Safari > 设置 > 高级，开启"在菜单栏中显示开发菜单"。',
                  '保持当前 App 和这个 WebView 页面打开。',
                  'Safari 菜单栏打开"开发"，选择当前 Mac、App 或页面。',
                  '点击对应页面后打开 Web Inspector。',
                ],
              ),
              const SizedBox(height: 12),
              const DebugStepsSection(
                title: 'Android Chrome',
                steps: [
                  '保持当前 App 和这个 WebView 页面打开。',
                  '在 Chrome 地址栏打开 chrome://inspect。',
                  '在 Remote Target 中找到当前 WebView。',
                  '点击 inspect 打开 DevTools。',
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '要求：iOS 16.4+ 或 macOS 13.3+ 支持 isInspectable。',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton.icon(
          onPressed: () {
            WebViewService.instance.reload(tab.id);
            Navigator.of(ctx).pop();
          },
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('刷新'),
        ),
        TextButton.icon(
          onPressed: () {
            Navigator.of(ctx).pop();
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              builder: (_) => const ConsoleSheet(),
            );
          },
          icon: const Icon(Icons.terminal, size: 16),
          label: const Text('控制台'),
        ),
        TextButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: tab.url));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('已复制 URL'),
                duration: Duration(seconds: 1),
              ),
            );
          },
          icon: const Icon(Icons.copy, size: 16),
          label: const Text('复制 URL'),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('知道了'),
        ),
      ],
    ),
  );
}
