import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
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
      title: Text('tab_new_tab'.tr(), style: const TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'tab_enter_url'.tr(),
        ),
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
          child: Text('cancel'.tr()),
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
          child: Text('tab_open'.tr()),
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
      title: Text('tab_navigate'.tr(), style: const TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: TextField(
        controller: controller,
        autofocus: true,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'tab_enter_url'.tr(),
          prefixIcon: const Icon(Icons.language, size: 16),
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
          child: Text('cancel'.tr()),
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
          child: Text('tab_navigate'.tr()),
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
      title: Text(
        'settings_device_selector'.tr(),
        style: const TextStyle(fontSize: 15),
      ),
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
      title: Text('tab_debug'.tr(), style: const TextStyle(fontSize: 15)),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DebugInfoRow(label: 'tab_tab_label'.tr(), value: tab.title),
              const SizedBox(height: 8),
              DebugInfoRow(label: 'tab_url_label'.tr(), value: tab.url),
              const SizedBox(height: 8),
              DebugInfoRow(
                label: 'tab_device_label'.tr(),
                value:
                    '${tab.device.name} '
                    '${tab.device.width.toInt()}x'
                    '${tab.device.height.toInt()}',
              ),
              const SizedBox(height: 12),
              Text(
                webViewDebuggingEnabled
                    ? 'tab_debug_inspectable_enabled'.tr()
                    : 'tab_debug_inspectable_disabled'.tr(),
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              DebugStepsSection(
                title: 'tab_debug_macos_safari'.tr(),
                steps: [
                  'tab_debug_safari_step1'.tr(),
                  'tab_debug_safari_step2'.tr(),
                  'tab_debug_safari_step3'.tr(),
                  'tab_debug_safari_step4'.tr(),
                ],
              ),
              const SizedBox(height: 12),
              DebugStepsSection(
                title: 'tab_debug_android_chrome'.tr(),
                steps: [
                  'tab_debug_chrome_step1'.tr(),
                  'tab_debug_chrome_step2'.tr(),
                  'tab_debug_chrome_step3'.tr(),
                  'tab_debug_chrome_step4'.tr(),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'tab_debug_requirement'.tr(),
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
          label: Text('tab_refresh_label'.tr()),
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
          label: Text('tab_console_label'.tr()),
        ),
        TextButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: tab.url));
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('tab_url_copied'.tr()),
                duration: const Duration(seconds: 1),
              ),
            );
          },
          icon: const Icon(Icons.copy, size: 16),
          label: Text('tab_copy_url'.tr()),
        ),
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text('ok'.tr()),
        ),
      ],
    ),
  );
}
