
enum DeviceType { phone, tablet, desktop }

class DeviceProfile {
  final DeviceType type;
  final String name;
  final double width;
  final double height;
  final String userAgentSuffix;

  const DeviceProfile({
    required this.type,
    required this.name,
    required this.width,
    required this.height,
    required this.userAgentSuffix,
  });

  static const phone = DeviceProfile(
    type: DeviceType.phone,
    name: 'Phone',
    width: 375,
    height: 812,
    userAgentSuffix:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );

  static const tablet = DeviceProfile(
    type: DeviceType.tablet,
    name: 'Tablet',
    width: 768,
    height: 1024,
    userAgentSuffix:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );

  static const desktop = DeviceProfile(
    type: DeviceType.desktop,
    name: 'Desktop',
    width: 1280,
    height: 800,
    userAgentSuffix: '',
  );

  static const defaults = [phone, tablet, desktop];

  static DeviceProfile fromType(DeviceType type) {
    return switch (type) {
      DeviceType.phone => phone,
      DeviceType.tablet => tablet,
      DeviceType.desktop => desktop,
    };
  }
}

class BrowserTab {
  final String id;
  final String title;
  final String url;
  final DeviceProfile device;
  final DateTime createdAt;

  BrowserTab({
    required this.id,
    required this.title,
    required this.url,
    this.device = DeviceProfile.desktop,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  BrowserTab copyWith({
    String? title,
    String? url,
    DeviceProfile? device,
  }) {
    return BrowserTab(
      id: id,
      title: title ?? this.title,
      url: url ?? this.url,
      device: device ?? this.device,
      createdAt: createdAt,
    );
  }
}
