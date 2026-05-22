import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:easy_localization/easy_localization.dart';
import '../providers/console_log_provider.dart';

class ConsoleSheet extends ConsumerWidget {
  const ConsoleSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(consoleLogProvider);
    final notifier = ref.read(consoleLogProvider.notifier);
    final theme = Theme.of(context);

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
              child: Row(
                children: [
                  Text('console_title'.tr(), style: theme.textTheme.titleSmall),
                  const Spacer(),
                  Switch(
                    value: state.capturing,
                    onChanged: (v) => notifier.setCapturing(v),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'console_capture_logs'.tr(),
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    onPressed: state.logs.isEmpty
                        ? null
                        : () {
                            Clipboard.setData(
                              ClipboardData(text: notifier.allLogsText),
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('console_copied'.tr()),
                                duration: const Duration(seconds: 1),
                              ),
                            );
                          },
                    icon: const Icon(Icons.copy, size: 18),
                    tooltip: 'console_copy_all'.tr(),
                    style: IconButton.styleFrom(
                      minimumSize: const Size(32, 32),
                      padding: EdgeInsets.zero,
                    ),
                  ),
                  IconButton(
                    onPressed: state.logs.isEmpty ? null : notifier.clearLogs,
                    icon: const Icon(Icons.delete_outline, size: 18),
                    tooltip: 'console_clear'.tr(),
                    style: IconButton.styleFrom(
                      minimumSize: const Size(32, 32),
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: state.logs.isEmpty
                  ? Center(
                      child: Text(
                        state.capturing ? 'console_empty'.tr() : 'console_empty_desc'.tr(),
                        style: TextStyle(
                          fontSize: 13,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    )
                  : ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      itemCount: state.logs.length,
                      itemBuilder: (_, i) {
                        final log = state.logs[i];
                        final color = _levelColor(log.level, theme);
                        return Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 2,
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${log.formattedTime} ',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                              Container(
                                margin: const EdgeInsets.only(top: 2),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                child: Text(
                                  log.level.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: color,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  log.message,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontFamily: 'monospace',
                                    color: color,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  Color _levelColor(String level, ThemeData theme) {
    return switch (level) {
      'error' => Colors.red,
      'warning' => Colors.orange,
      'debug' => Colors.grey,
      'info' => theme.colorScheme.primary,
      _ => theme.colorScheme.onSurface,
    };
  }
}
