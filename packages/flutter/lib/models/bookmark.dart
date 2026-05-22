import 'package:flutter/foundation.dart';

import 'browser_tab.dart';

class Bookmark {
  final String id;
  final String name;
  final String url;
  final DeviceType deviceType;
  final DateTime createdAt;

  Bookmark({
    required this.id,
    required this.name,
    required this.url,
    this.deviceType = DeviceType.desktop,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'url': url,
    'deviceType': deviceType.index,
    'createdAt': createdAt.toIso8601String(),
  };

  Bookmark copyWith({String? name, String? url, DeviceType? deviceType}) =>
      Bookmark(
        id: id,
        name: name ?? this.name,
        url: url ?? this.url,
        deviceType: deviceType ?? this.deviceType,
        createdAt: createdAt,
      );

  factory Bookmark.fromJson(Map<String, dynamic> json) => Bookmark(
    id: json['id'] as String,
    name: json['name'] as String,
    url: json['url'] as String,
    deviceType: DeviceType.values[json['deviceType'] as int],
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

class AppSettings {
  final bool restoreTabsOnStartup;
  final bool restoreLayoutOnStartup;
  final bool webViewDebuggingEnabled;
  final bool incognito;

  const AppSettings({
    this.restoreTabsOnStartup = true,
    this.restoreLayoutOnStartup = true,
    this.webViewDebuggingEnabled = kDebugMode,
    this.incognito = false,
  });

  AppSettings copyWith({
    bool? restoreTabsOnStartup,
    bool? restoreLayoutOnStartup,
    bool? webViewDebuggingEnabled,
    bool? incognito,
  }) {
    return AppSettings(
      restoreTabsOnStartup: restoreTabsOnStartup ?? this.restoreTabsOnStartup,
      restoreLayoutOnStartup:
          restoreLayoutOnStartup ?? this.restoreLayoutOnStartup,
      webViewDebuggingEnabled:
          webViewDebuggingEnabled ?? this.webViewDebuggingEnabled,
      incognito: incognito ?? this.incognito,
    );
  }

  Map<String, dynamic> toJson() => {
    'restoreTabsOnStartup': restoreTabsOnStartup,
    'restoreLayoutOnStartup': restoreLayoutOnStartup,
    'webViewDebuggingEnabled': webViewDebuggingEnabled,
    'incognito': incognito,
  };

  factory AppSettings.fromJson(Map<String, dynamic> json) => AppSettings(
    restoreTabsOnStartup: json['restoreTabsOnStartup'] as bool? ?? true,
    restoreLayoutOnStartup: json['restoreLayoutOnStartup'] as bool? ?? true,
    webViewDebuggingEnabled:
        json['webViewDebuggingEnabled'] as bool? ?? kDebugMode,
    incognito: json['incognito'] as bool? ?? false,
  );
}
