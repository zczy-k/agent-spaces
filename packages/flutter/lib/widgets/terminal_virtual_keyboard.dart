import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

enum _HapticStyle { light, medium }

class TerminalVirtualKeyboard extends StatefulWidget {
  const TerminalVirtualKeyboard({super.key, required this.onKey});

  final ValueChanged<String> onKey;

  @override
  State<TerminalVirtualKeyboard> createState() =>
      _TerminalVirtualKeyboardState();
}

class _TerminalVirtualKeyboardState extends State<TerminalVirtualKeyboard> {
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
      color: const Color(0xFF121212),
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
      hapticStyle: _HapticStyle.medium,
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
    _HapticStyle hapticStyle = _HapticStyle.light,
    VoidCallback? onTap,
  }) {
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: SizedBox(
          height: 36,
          child: TextButton(
            onPressed: () {
              _performHaptic(hapticStyle);
              (onTap ?? () => widget.onKey(value))();
            },
            style: TextButton.styleFrom(
              backgroundColor: selected
                  ? Colors.blueGrey.shade700
                  : const Color(0xFF1E1E1E),
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

  void _performHaptic(_HapticStyle style) {
    if (style == _HapticStyle.medium) {
      HapticFeedback.mediumImpact();
    } else {
      HapticFeedback.selectionClick();
    }
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
