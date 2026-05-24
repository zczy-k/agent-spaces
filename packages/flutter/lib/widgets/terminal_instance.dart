import 'dart:async';
import 'dart:convert';

import 'package:dartssh2/dartssh2.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:xterm/xterm.dart';
import 'package:easy_localization/easy_localization.dart';

import '../models/browser_tab.dart';
import '../models/terminal_credential.dart';
import '../providers/browser_provider.dart';
import '../providers/terminal_credentials_provider.dart';
import 'terminal_login_form.dart';
import 'terminal_toolbar.dart';
import 'terminal_virtual_keyboard.dart';

class TerminalInstance extends ConsumerStatefulWidget {
  final BrowserTab tab;
  final ValueChanged<String>? onTitleChanged;

  const TerminalInstance({super.key, required this.tab, this.onTitleChanged});

  @override
  ConsumerState<TerminalInstance> createState() => _TerminalInstanceState();
}

class _TerminalInstanceState extends ConsumerState<TerminalInstance> {
  late final Terminal _terminal;
  late final TerminalController _terminalController;
  final _pasteController = TextEditingController();

  SSHClient? _client;
  SSHSession? _session;
  StreamSubscription<String>? _stdoutSubscription;
  StreamSubscription<String>? _stderrSubscription;
  final List<String> _commandHistory = [];
  final StringBuffer _currentCommand = StringBuffer();
  bool _connecting = false;
  bool _connected = false;
  bool _virtualKeyboardOpen = false;

  @override
  void initState() {
    super.initState();
    _terminal = Terminal();
    _terminalController = TerminalController();
    _terminal.onTitleChange = (title) {
      widget.onTitleChanged?.call(title.isEmpty ? 'Terminal' : title);
    };
    final credential = widget.tab.terminalCredential;
    if (credential != null) {
      Future.microtask(() => _connectWithCredential(credential));
    }
  }

  @override
  void dispose() {
    _disconnect();
    _terminalController.dispose();
    _pasteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_connected) {
      return TerminalLoginForm(connecting: _connecting, onConnect: _connect);
    }

    return ColoredBox(
      color: Colors.black,
      child: Column(
        children: [
          Expanded(
            child: TerminalView(
              _terminal,
              controller: _terminalController,
              autofocus: true,
              padding: const EdgeInsets.all(8),
              backgroundOpacity: 1,
            ),
          ),
          if (_virtualKeyboardOpen)
            TerminalVirtualKeyboard(onKey: _sendTerminalInput),
          TerminalToolbar(
            terminal: _terminal,
            terminalController: _terminalController,
            historyEnabled: _commandHistory.isNotEmpty,
            keyboardOpen: _virtualKeyboardOpen,
            onSend: _sendTerminalInput,
            onHistory: _showCommandHistory,
            onToggleKeyboard: () {
              setState(() => _virtualKeyboardOpen = !_virtualKeyboardOpen);
            },
            onPaste: _showPasteCommandDialog,
          ),
        ],
      ),
    );
  }

  Future<void> _connect({
    required String host,
    required int port,
    required String username,
    required String password,
    required String privateKey,
    required String passphrase,
    required bool usePrivateKey,
    required bool saveCredential,
    required String credentialName,
  }) async {
    setState(() => _connecting = true);
    _terminal.write('Connecting to $host:$port...\r\n');

    try {
      final identities = usePrivateKey
          ? SSHKeyPair.fromPem(
              privateKey,
              passphrase.trim().isEmpty ? null : passphrase,
            )
          : null;
      final client = SSHClient(
        await SSHSocket.connect(host, port),
        username: username,
        onPasswordRequest: usePrivateKey ? null : () => password,
        identities: identities,
      );
      final session = await client.shell(
        pty: SSHPtyConfig(
          width: _terminal.viewWidth,
          height: _terminal.viewHeight,
        ),
      );

      _client = client;
      _session = session;
      _terminal.buffer.clear();
      _terminal.buffer.setCursor(0, 0);
      _terminal.onOutput = _sendTerminalInput;
      _terminal.onResize = (width, height, pixelWidth, pixelHeight) {
        session.resizeTerminal(width, height, pixelWidth, pixelHeight);
      };
      _stdoutSubscription = session.stdout
          .cast<List<int>>()
          .transform(const Utf8Decoder())
          .listen(_terminal.write);
      _stderrSubscription = session.stderr
          .cast<List<int>>()
          .transform(const Utf8Decoder())
          .listen(_terminal.write);
      session.done.whenComplete(() {
        if (!mounted) return;
        _terminal.write('\r\n[Disconnected]\r\n');
        setState(() => _connected = false);
      });

      final tabCredential = TerminalCredential(
        id: widget.tab.terminalCredential?.id ?? 'tab-${widget.tab.id}',
        name: credentialName.isEmpty ? '$username@$host' : credentialName,
        host: host,
        port: port,
        username: username,
        password: usePrivateKey ? null : password,
        privateKey: usePrivateKey ? privateKey : null,
        passphrase: usePrivateKey ? passphrase : null,
        createdAt: widget.tab.terminalCredential?.createdAt ?? DateTime.now(),
      );
      ref
          .read(browserProvider.notifier)
          .setTerminalCredential(widget.tab.id, tabCredential);

      if (saveCredential) {
        ref
            .read(terminalCredentialsProvider.notifier)
            .add(
              name: tabCredential.name,
              host: host,
              port: port,
              username: username,
              password: usePrivateKey ? null : password,
              privateKey: usePrivateKey ? privateKey : null,
              passphrase: usePrivateKey ? passphrase : null,
            );
      }

      if (!mounted) return;
      setState(() {
        _connected = true;
        _connecting = false;
      });
      widget.onTitleChanged?.call('$username@$host');
    } catch (error) {
      _client?.close();
      _client = null;
      _session = null;
      if (!mounted) return;
      setState(() => _connecting = false);
      _terminal.write('Connection failed: $error\r\n');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'terminal_connection_failed'.tr(args: [error.toString()]),
            ),
          ),
        );
      }
    }
  }

  Future<void> _connectWithCredential(TerminalCredential credential) {
    return _connect(
      host: credential.host,
      port: credential.port,
      username: credential.username,
      password: credential.password ?? '',
      privateKey: credential.privateKey ?? '',
      passphrase: credential.passphrase ?? '',
      usePrivateKey: credential.usesPrivateKey,
      saveCredential: false,
      credentialName: credential.name,
    );
  }

  void _disconnect() {
    _stdoutSubscription?.cancel();
    _stderrSubscription?.cancel();
    _session?.close();
    _client?.close();
    _session = null;
    _client = null;
  }

  void _sendTerminalInput(String data) {
    final session = _session;
    if (session == null || data.isEmpty) return;

    _recordLocalInput(data);
    session.write(utf8.encode(data));
  }

  void _recordLocalInput(String data) {
    for (final codeUnit in data.codeUnits) {
      switch (codeUnit) {
        case 3:
          _currentCommand.clear();
        case 8:
        case 127:
          final text = _currentCommand.toString();
          _currentCommand
            ..clear()
            ..write(text.isEmpty ? '' : text.substring(0, text.length - 1));
        case 10:
        case 13:
          _pushCommandHistory(_currentCommand.toString());
          _currentCommand.clear();
        case 27:
          break;
        default:
          if (codeUnit >= 32) {
            _currentCommand.writeCharCode(codeUnit);
          }
      }
    }
  }

  void _pushCommandHistory(String command) {
    final value = command.trim();
    if (value.isEmpty) return;

    final wasEmpty = _commandHistory.isEmpty;
    _commandHistory.remove(value);
    _commandHistory.insert(0, value);
    if (_commandHistory.length > 50) {
      _commandHistory.removeRange(50, _commandHistory.length);
    }
    if (wasEmpty && mounted) {
      setState(() {});
    }
  }

  Future<void> _showCommandHistory() async {
    if (_commandHistory.isEmpty) return;

    final command = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('terminal_command_history'.tr()),
        content: SizedBox(
          width: 520,
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: _commandHistory.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final command = _commandHistory[index];
              return ListTile(
                dense: true,
                title: Text(
                  command,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontFamily: 'monospace'),
                ),
                onTap: () => Navigator.of(context).pop(command),
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('cancel'.tr()),
          ),
        ],
      ),
    );

    if (command != null) {
      _sendTerminalInput(command);
    }
  }

  Future<void> _showPasteCommandDialog() async {
    final clipboardData = await Clipboard.getData(Clipboard.kTextPlain);
    _pasteController.text = clipboardData?.text ?? '';
    if (!mounted) return;

    final commands = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('terminal_paste_command'.tr()),
        content: SizedBox(
          width: 520,
          child: TextField(
            controller: _pasteController,
            minLines: 5,
            maxLines: 10,
            style: const TextStyle(fontFamily: 'monospace'),
            decoration: InputDecoration(
              hintText: 'terminal_paste_command_placeholder'.tr(),
              border: const OutlineInputBorder(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(_pasteController.text),
            child: Text('confirm'.tr()),
          ),
        ],
      ),
    );

    if (commands == null || commands.trim().isEmpty) return;
    final normalized = commands.endsWith('\n') || commands.endsWith('\r')
        ? commands
        : '$commands\n';
    _sendTerminalInput(normalized.replaceAll('\n', '\r'));
  }
}
