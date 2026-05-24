import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:xterm/xterm.dart';

class TerminalToolbar extends StatelessWidget {
  const TerminalToolbar({
    super.key,
    required this.terminal,
    required this.terminalController,
    required this.historyEnabled,
    required this.keyboardOpen,
    required this.onSend,
    required this.onHistory,
    required this.onToggleKeyboard,
    required this.onPaste,
  });

  final Terminal terminal;
  final TerminalController terminalController;
  final bool historyEnabled;
  final bool keyboardOpen;
  final ValueChanged<String> onSend;
  final VoidCallback onHistory;
  final VoidCallback onToggleKeyboard;
  final VoidCallback onPaste;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest,
          border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              TerminalToolButton(
                icon: Icons.keyboard_arrow_up,
                tooltip: 'terminal_cursor_up'.tr(),
                onPressed: () => onSend('\x1b[A'),
              ),
              TerminalToolButton(
                icon: Icons.keyboard_arrow_down,
                tooltip: 'terminal_cursor_down'.tr(),
                onPressed: () => onSend('\x1b[B'),
              ),
              TerminalToolButton(
                icon: Icons.keyboard_arrow_left,
                tooltip: 'terminal_cursor_left'.tr(),
                onPressed: () => onSend('\x1b[D'),
              ),
              TerminalToolButton(
                icon: Icons.keyboard_arrow_right,
                tooltip: 'terminal_cursor_right'.tr(),
                onPressed: () => onSend('\x1b[C'),
              ),
              const TerminalToolbarDivider(),
              TerminalToolButton(
                icon: Icons.history,
                label: 'terminal_command_history_short'.tr(),
                tooltip: 'terminal_command_history'.tr(),
                onPressed: historyEnabled ? onHistory : null,
              ),
              TerminalToolButton(
                icon: Icons.keyboard,
                selected: keyboardOpen,
                label: 'terminal_virtual_keyboard'.tr(),
                tooltip: 'terminal_virtual_keyboard'.tr(),
                onPressed: onToggleKeyboard,
              ),
              TerminalToolButton(
                icon: Icons.power_settings_new,
                label: 'terminal_exit'.tr(),
                tooltip: 'terminal_exit'.tr(),
                onPressed: () => onSend('\x03'),
              ),
              TerminalToolButton(
                icon: Icons.cleaning_services,
                label: 'terminal_clear_screen'.tr(),
                tooltip: 'terminal_clear_screen'.tr(),
                onPressed: () => onSend('clear\r'),
              ),
              TerminalToolButton(
                icon: Icons.copy,
                label: 'terminal_copy'.tr(),
                tooltip: 'terminal_copy'.tr(),
                onPressed: () {
                  final selection = terminalController.selection;
                  if (selection == null) return;
                  final text = terminal.buffer.getText(selection);
                  if (text.isEmpty) return;
                  Clipboard.setData(ClipboardData(text: text));
                },
              ),
              TerminalToolButton(
                icon: Icons.content_paste,
                label: 'terminal_paste_command_short'.tr(),
                tooltip: 'terminal_paste_command'.tr(),
                onPressed: onPaste,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class TerminalToolbarDivider extends StatelessWidget {
  const TerminalToolbarDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: 1,
      height: 24,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: colorScheme.outlineVariant,
    );
  }
}

class TerminalToolButton extends StatelessWidget {
  const TerminalToolButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.label,
    this.selected = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final String? label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final foreground = selected
        ? colorScheme.onPrimaryContainer
        : colorScheme.onSurfaceVariant;
    final background = selected
        ? colorScheme.primaryContainer
        : Colors.transparent;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Tooltip(
        message: tooltip,
        child: TextButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: 18),
          label: label == null ? const SizedBox.shrink() : Text(label!),
          style: TextButton.styleFrom(
            backgroundColor: background,
            foregroundColor: foreground,
            disabledForegroundColor: colorScheme.onSurface.withValues(
              alpha: 0.38,
            ),
            minimumSize: const Size(40, 36),
            padding: EdgeInsets.symmetric(horizontal: label == null ? 8 : 10),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
      ),
    );
  }
}
