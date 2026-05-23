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
import '../providers/terminal_credentials_provider.dart';

class TerminalInstance extends ConsumerStatefulWidget {
  final BrowserTab tab;
  final ValueChanged<String>? onTitleChanged;

  const TerminalInstance({super.key, required this.tab, this.onTitleChanged});

  @override
  ConsumerState<TerminalInstance> createState() => _TerminalInstanceState();
}

class _TerminalInstanceState extends ConsumerState<TerminalInstance> {
  late final Terminal _terminal;
  final _hostController = TextEditingController();
  final _portController = TextEditingController(text: '22');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _privateKeyController = TextEditingController();
  final _passphraseController = TextEditingController();
  final _nameController = TextEditingController();
  final _pasteController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  SSHClient? _client;
  SSHSession? _session;
  StreamSubscription<String>? _stdoutSubscription;
  StreamSubscription<String>? _stderrSubscription;
  final List<String> _commandHistory = [];
  final StringBuffer _currentCommand = StringBuffer();
  bool _connecting = false;
  bool _connected = false;
  bool _saveCredential = false;
  bool _usePrivateKey = false;
  bool _virtualKeyboardOpen = false;
  String? _selectedCredentialId;

  @override
  void initState() {
    super.initState();
    _terminal = Terminal();
    _terminal.onTitleChange = (title) {
      widget.onTitleChanged?.call(title.isEmpty ? 'Terminal' : title);
    };
  }

  @override
  void dispose() {
    _disconnect();
    _hostController.dispose();
    _portController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _privateKeyController.dispose();
    _passphraseController.dispose();
    _nameController.dispose();
    _pasteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_connected) {
      return _buildLoginPlaceholder(context);
    }

    return ColoredBox(
      color: Colors.black,
      child: Column(
        children: [
          Expanded(
            child: TerminalView(
              _terminal,
              autofocus: true,
              padding: const EdgeInsets.all(8),
              backgroundOpacity: 1,
            ),
          ),
          if (_virtualKeyboardOpen)
            _TerminalVirtualKeyboard(onKey: _sendTerminalInput),
          _TerminalToolbar(
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

  Widget _buildLoginPlaceholder(BuildContext context) {
    final theme = Theme.of(context);
    final credentials = ref.watch(terminalCredentialsProvider);

    return SizedBox.expand(
      child: ColoredBox(
        color: theme.colorScheme.surface,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Card(
              margin: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.terminal,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'terminal_new'.tr(),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      if (credentials.isNotEmpty) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _selectedCredentialId,
                          decoration: InputDecoration(
                            labelText: 'terminal_select_saved_credential'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          items: credentials
                              .map(
                                (credential) => DropdownMenuItem(
                                  value: credential.id,
                                  child: Text(
                                    '${credential.name} (${credential.username}@${credential.host}:${credential.port})',
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (id) {
                            final credential = credentials.firstWhere(
                              (item) => item.id == id,
                            );
                            setState(() {
                              _selectedCredentialId = id;
                              _applyCredential(credential);
                            });
                          },
                        ),
                        const SizedBox(height: 14),
                      ],
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: TextFormField(
                              controller: _hostController,
                              decoration: InputDecoration(
                                labelText: 'terminal_host'.tr(),
                                hintText: 'example.com',
                                border: const OutlineInputBorder(),
                              ),
                              validator: (value) =>
                                  value == null || value.trim().isEmpty
                                  ? 'terminal_host_hint'.tr()
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _portController,
                              decoration: InputDecoration(
                                labelText: 'terminal_port'.tr(),
                                border: const OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.number,
                              validator: (value) {
                                final port = int.tryParse(value ?? '');
                                if (port == null || port <= 0 || port > 65535) {
                                  return 'terminal_port_invalid'.tr();
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _usernameController,
                        decoration: InputDecoration(
                          labelText: 'terminal_username'.tr(),
                          border: const OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            value == null || value.trim().isEmpty
                            ? 'terminal_username_hint'.tr()
                            : null,
                      ),
                      const SizedBox(height: 10),
                      SegmentedButton<bool>(
                        segments: [
                          ButtonSegment(
                            value: false,
                            label: Text('terminal_password_login'.tr()),
                          ),
                          ButtonSegment(
                            value: true,
                            label: Text('terminal_key_login'.tr()),
                          ),
                        ],
                        selected: {_usePrivateKey},
                        onSelectionChanged: (values) {
                          setState(() => _usePrivateKey = values.first);
                        },
                      ),
                      const SizedBox(height: 14),
                      if (_usePrivateKey) ...[
                        TextFormField(
                          controller: _privateKeyController,
                          decoration: InputDecoration(
                            labelText: 'terminal_private_key_pem'.tr(),
                            hintText: '-----BEGIN OPENSSH PRIVATE KEY-----',
                            border: const OutlineInputBorder(),
                          ),
                          minLines: 4,
                          maxLines: 8,
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'terminal_private_key_hint'.tr()
                              : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passphraseController,
                          decoration: InputDecoration(
                            labelText: 'terminal_key_passphrase'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                        ),
                      ] else
                        TextFormField(
                          controller: _passwordController,
                          decoration: InputDecoration(
                            labelText: 'terminal_password'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                        ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('terminal_save_credential'.tr()),
                        subtitle: Text('terminal_save_credential_desc'.tr()),
                        value: _saveCredential,
                        onChanged: (value) =>
                            setState(() => _saveCredential = value),
                      ),
                      if (_saveCredential) ...[
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _nameController,
                          decoration: InputDecoration(
                            labelText: 'terminal_credential_name'.tr(),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: _connecting ? null : _connect,
                        icon: _connecting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.login),
                        label: Text(
                          _connecting
                              ? 'terminal_connecting'.tr()
                              : 'terminal_login'.tr(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _applyCredential(TerminalCredential credential) {
    _hostController.text = credential.host;
    _portController.text = credential.port.toString();
    _usernameController.text = credential.username;
    _passwordController.text = credential.password ?? '';
    _privateKeyController.text = credential.privateKey ?? '';
    _passphraseController.text = credential.passphrase ?? '';
    _nameController.text = credential.name;
    _usePrivateKey = credential.usesPrivateKey;
  }

  Future<void> _connect() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final host = _hostController.text.trim();
    final port = int.parse(_portController.text.trim());
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final privateKey = _privateKeyController.text.trim();
    final passphrase = _passphraseController.text;

    setState(() => _connecting = true);
    _terminal.write('Connecting to $host:$port...\r\n');

    try {
      final identities = _usePrivateKey
          ? SSHKeyPair.fromPem(
              privateKey,
              passphrase.trim().isEmpty ? null : passphrase,
            )
          : null;
      final client = SSHClient(
        await SSHSocket.connect(host, port),
        username: username,
        onPasswordRequest: _usePrivateKey ? null : () => password,
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

      if (_saveCredential) {
        ref
            .read(terminalCredentialsProvider.notifier)
            .add(
              name: _credentialName(host, username),
              host: host,
              port: port,
              username: username,
              password: _usePrivateKey ? null : password,
              privateKey: _usePrivateKey ? privateKey : null,
              passphrase: _usePrivateKey ? passphrase : null,
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'terminal_connection_failed'.tr(args: [error.toString()]),
          ),
        ),
      );
    }
  }

  String _credentialName(String host, String username) {
    final name = _nameController.text.trim();
    return name.isEmpty ? '$username@$host' : name;
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
            separatorBuilder: (_, __) => const Divider(height: 1),
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

class _TerminalToolbar extends StatelessWidget {
  const _TerminalToolbar({
    required this.historyEnabled,
    required this.keyboardOpen,
    required this.onSend,
    required this.onHistory,
    required this.onToggleKeyboard,
    required this.onPaste,
  });

  final bool historyEnabled;
  final bool keyboardOpen;
  final ValueChanged<String> onSend;
  final VoidCallback onHistory;
  final VoidCallback onToggleKeyboard;
  final VoidCallback onPaste;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.grey.shade900,
          border: Border(top: BorderSide(color: Colors.grey.shade800)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _TerminalToolButton(
                icon: Icons.keyboard_arrow_up,
                tooltip: 'terminal_cursor_up'.tr(),
                onPressed: () => onSend('\x1b[A'),
              ),
              _TerminalToolButton(
                icon: Icons.keyboard_arrow_down,
                tooltip: 'terminal_cursor_down'.tr(),
                onPressed: () => onSend('\x1b[B'),
              ),
              _TerminalToolButton(
                icon: Icons.keyboard_arrow_left,
                tooltip: 'terminal_cursor_left'.tr(),
                onPressed: () => onSend('\x1b[D'),
              ),
              _TerminalToolButton(
                icon: Icons.keyboard_arrow_right,
                tooltip: 'terminal_cursor_right'.tr(),
                onPressed: () => onSend('\x1b[C'),
              ),
              const _TerminalToolbarDivider(),
              _TerminalToolButton(
                icon: Icons.history,
                label: 'terminal_command_history_short'.tr(),
                tooltip: 'terminal_command_history'.tr(),
                onPressed: historyEnabled ? onHistory : null,
              ),
              _TerminalToolButton(
                icon: Icons.keyboard,
                selected: keyboardOpen,
                label: 'terminal_virtual_keyboard'.tr(),
                tooltip: 'terminal_virtual_keyboard'.tr(),
                onPressed: onToggleKeyboard,
              ),
              _TerminalToolButton(
                icon: Icons.power_settings_new,
                label: 'terminal_exit'.tr(),
                tooltip: 'terminal_exit'.tr(),
                onPressed: () => onSend('\x03'),
              ),
              _TerminalToolButton(
                icon: Icons.cleaning_services,
                label: 'terminal_clear_screen'.tr(),
                tooltip: 'terminal_clear_screen'.tr(),
                onPressed: () => onSend('clear\r'),
              ),
              _TerminalToolButton(
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

class _TerminalToolbarDivider extends StatelessWidget {
  const _TerminalToolbarDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 24,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: Colors.grey.shade700,
    );
  }
}

class _TerminalToolButton extends StatelessWidget {
  const _TerminalToolButton({
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
    final foreground = selected ? Colors.white : Colors.grey.shade300;
    final background = selected ? Colors.blueGrey.shade700 : Colors.transparent;

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
            disabledForegroundColor: Colors.grey.shade600,
            minimumSize: const Size(40, 36),
            padding: EdgeInsets.symmetric(horizontal: label == null ? 8 : 10),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
      ),
    );
  }
}

class _TerminalVirtualKeyboard extends StatefulWidget {
  const _TerminalVirtualKeyboard({required this.onKey});

  final ValueChanged<String> onKey;

  @override
  State<_TerminalVirtualKeyboard> createState() =>
      _TerminalVirtualKeyboardState();
}

class _TerminalVirtualKeyboardState extends State<_TerminalVirtualKeyboard> {
  static const _rows = [
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', r'\'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Back'],
  ];

  static const _ctrlMap = {
    'a': '\x01',
    'b': '\x02',
    'c': '\x03',
    'd': '\x04',
    'e': '\x05',
    'f': '\x06',
    'g': '\x07',
    'h': '\x08',
    'i': '\x09',
    'j': '\x0a',
    'k': '\x0b',
    'l': '\x0c',
    'm': '\x0d',
    'n': '\x0e',
    'o': '\x0f',
    'p': '\x10',
    'q': '\x11',
    'r': '\x12',
    's': '\x13',
    't': '\x14',
    'u': '\x15',
    'v': '\x16',
    'w': '\x17',
    'x': '\x18',
    'y': '\x19',
    'z': '\x1a',
    '[': '\x1b',
    ']': '\x1d',
    r'\': '\x1c',
  };

  final Set<String> _modifiers = {};

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.grey.shade950,
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _modifierKey('ctrl'),
              _modifierKey('alt'),
              _modifierKey('shift'),
              _key('Tab', '\t'),
              _key('Esc', '\x1b'),
              _key('Up', '\x1b[A'),
              _key('Down', '\x1b[B'),
              _key('Left', '\x1b[D'),
              _key('Right', '\x1b[C'),
            ],
          ),
          const SizedBox(height: 4),
          for (final row in _rows) ...[
            Row(children: row.map(_characterKey).toList()),
            const SizedBox(height: 4),
          ],
          Row(children: [_key('Space', ' ', flex: 5)]),
        ],
      ),
    );
  }

  Widget _modifierKey(String value) {
    final selected = _modifiers.contains(value);
    return _key(
      value.toUpperCase(),
      '',
      selected: selected,
      onTap: () {
        setState(() {
          selected ? _modifiers.remove(value) : _modifiers.add(value);
        });
      },
    );
  }

  Widget _characterKey(String value) {
    return _key(
      value,
      value,
      flex: value == 'Enter' || value == 'Back' ? 2 : 1,
      onTap: () => _sendCharacter(value),
    );
  }

  Widget _key(
    String label,
    String value, {
    int flex = 1,
    bool selected = false,
    VoidCallback? onTap,
  }) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: SizedBox(
          height: 36,
          child: TextButton(
            onPressed: onTap ?? () => widget.onKey(value),
            style: TextButton.styleFrom(
              backgroundColor: selected
                  ? Colors.blueGrey.shade700
                  : Colors.grey.shade850,
              foregroundColor: Colors.grey.shade100,
              padding: EdgeInsets.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(fontSize: 12),
            ),
            child: FittedBox(child: Text(label)),
          ),
        ),
      ),
    );
  }

  void _sendCharacter(String value) {
    final ctrl = _modifiers.contains('ctrl');
    final alt = _modifiers.contains('alt');
    final shift = _modifiers.contains('shift');

    final data = switch (value) {
      'Enter' => '\r',
      'Back' => '\x7f',
      _ when ctrl && _ctrlMap.containsKey(value) => _ctrlMap[value]!,
      _ => shift ? value.toUpperCase() : value,
    };

    widget.onKey(alt ? '\x1b$data' : data);
    setState(_modifiers.clear);
  }
}
