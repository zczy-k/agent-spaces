import 'package:flutter/material.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';
import 'webview_instance.dart';

typedef TitleChangedCallback = void Function(String tabId, String title, String url, String? faviconUrl);

Widget _buildWebViewPane(BrowserTab tab, bool webViewDebuggingEnabled, TitleChangedCallback onTitleChanged) {
  return WebViewInstance(
    key: ValueKey('${tab.id}-$webViewDebuggingEnabled'),
    tab: tab,
    onTitleChanged: onTitleChanged,
  );
}

Widget buildSplitLayout({
  required BuildContext context,
  required SplitLayout layout,
  required List<BrowserTab> visibleTabs,
  required bool webViewDebuggingEnabled,
  required TitleChangedCallback onTitleChanged,
}) {
  final dividerColor = Theme.of(context).colorScheme.outlineVariant;
  const dividerThickness = 1.0;

  final children = visibleTabs.map((tab) {
    return Expanded(
      child: _buildWebViewPane(tab, webViewDebuggingEnabled, onTitleChanged),
    );
  }).toList();

  return switch (layout) {
    SplitLayout.single => const SizedBox.shrink(),
    SplitLayout.horizontal2 => _buildRow(children, dividerColor, dividerThickness),
    SplitLayout.vertical2 => _buildColumn(children, dividerColor, dividerThickness),
    SplitLayout.horizontal3 => _buildRow(children, dividerColor, dividerThickness),
    SplitLayout.quad => _buildQuad(visibleTabs, webViewDebuggingEnabled, onTitleChanged, dividerColor, dividerThickness),
  };
}

Widget _buildRow(List<Widget> children, Color dividerColor, double thickness) {
  final result = <Widget>[];
  for (int i = 0; i < children.length; i++) {
    if (i > 0) {
      result.add(VerticalDivider(width: thickness, thickness: thickness, color: dividerColor));
    }
    result.add(children[i]);
  }
  return Row(children: result);
}

Widget _buildColumn(List<Widget> children, Color dividerColor, double thickness) {
  final result = <Widget>[];
  for (int i = 0; i < children.length; i++) {
    if (i > 0) {
      result.add(Divider(height: thickness, thickness: thickness, color: dividerColor));
    }
    result.add(children[i]);
  }
  return Column(children: result);
}

Widget _buildQuad(
  List<BrowserTab> visibleTabs,
  bool webViewDebuggingEnabled,
  TitleChangedCallback onTitleChanged,
  Color dividerColor,
  double thickness,
) {
  while (visibleTabs.length < 4) {
    visibleTabs = [...visibleTabs, visibleTabs.last];
  }
  final top = <Widget>[];
  final bottom = <Widget>[];
  for (int i = 0; i < 4; i++) {
    final pane = Expanded(
      child: _buildWebViewPane(visibleTabs[i], webViewDebuggingEnabled, onTitleChanged),
    );
    if (i < 2) {
      if (top.isNotEmpty) top.add(VerticalDivider(width: thickness, thickness: thickness, color: dividerColor));
      top.add(pane);
    } else {
      if (bottom.isNotEmpty) bottom.add(VerticalDivider(width: thickness, thickness: thickness, color: dividerColor));
      bottom.add(pane);
    }
  }
  return Column(children: [
    Expanded(child: Row(children: top)),
    Divider(height: thickness, thickness: thickness, color: dividerColor),
    Expanded(child: Row(children: bottom)),
  ]);
}
