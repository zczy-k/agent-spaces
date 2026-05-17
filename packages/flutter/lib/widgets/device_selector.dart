import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/browser_tab.dart';
import '../providers/browser_provider.dart';

class DeviceSelector extends ConsumerWidget {
  const DeviceSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(browserProvider);
    final notifier = ref.read(browserProvider.notifier);
    final activeTab = state.activeTab;

    if (activeTab == null) return const SizedBox.shrink();

    return PopupMenuButton<DeviceProfile>(
      onSelected: (device) {
        notifier.setDevice(device, activeTab.id);
      },
      initialValue: activeTab.device,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_deviceIcon(activeTab.device.type), size: 16),
            const SizedBox(width: 4),
            Text(activeTab.device.name, style: const TextStyle(fontSize: 12)),
            const Icon(Icons.arrow_drop_down, size: 16),
          ],
        ),
      ),
      itemBuilder: (context) => DeviceProfile.defaults
          .map((d) => PopupMenuItem(
                value: d,
                child: Row(
                  children: [
                    Icon(_deviceIcon(d.type), size: 18),
                    const SizedBox(width: 8),
                    Text('${d.name} (${d.width.toInt()}x${d.height.toInt()})'),
                  ],
                ),
              ))
          .toList(),
    );
  }

  IconData _deviceIcon(DeviceType type) {
    return switch (type) {
      DeviceType.phone => Icons.phone_android,
      DeviceType.tablet => Icons.tablet,
      DeviceType.desktop => Icons.desktop_windows,
    };
  }
}
