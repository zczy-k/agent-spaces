import 'dart:ui';
import 'package:awesome_notifications/awesome_notifications.dart';
import 'package:logger/logger.dart';

class NotificationService {
  static final _log = Logger(printer: PrettyPrinter(methodCount: 0));
  static const _channelKey = 'agent_spaces_channel';

  Future<void> initialize() async {
    await AwesomeNotifications().initialize(
      null,
      [
        NotificationChannel(
          channelKey: _channelKey,
          channelName: 'Agent Spaces',
          channelDescription: 'Agent Spaces notifications',
          defaultColor: const Color(0xFF2563EB),
          ledColor: const Color(0xFF2563EB),
          importance: NotificationImportance.High,
        ),
      ],
    );
    _log.i('NotificationService initialized');
  }

  Future<bool> requestPermission() async {
    final isAllowed = await AwesomeNotifications().isNotificationAllowed();
    if (!isAllowed) {
      return await AwesomeNotifications().requestPermissionToSendNotifications();
    }
    return true;
  }

  Future<void> showNotification({
    required String title,
    required String body,
    int? id,
    Map<String, String?>? payload,
  }) async {
    await AwesomeNotifications().createNotification(
      content: NotificationContent(
        id: id ?? DateTime.now().millisecond,
        channelKey: _channelKey,
        title: title,
        body: body,
        payload: payload,
      ),
    );
    _log.i('Notification sent: $title');
  }
}
