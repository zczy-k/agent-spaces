import 'dart:convert';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:logger/logger.dart';

class JsBridge {
  static final _log = Logger(printer: PrettyPrinter(methodCount: 0));

  static const _jsInject = '''
    window.__FLUTTER_INTERNALS__ = true;
    window.__flutterBridge = {
      _handlers: {},
      on: function(event, handler) {
        this._handlers[event] = handler;
      },
      emit: function(event, data) {
        window.flutter_inappwebview.callHandler('bridgeEvent', JSON.stringify({event: event, data: data}));
      },
      invoke: function(method, args) {
        window.flutter_inappwebview.callHandler('bridgeInvoke', JSON.stringify({method: method, args: args}));
      }
    };
    window.isFlutterEnvironment = function() { return true; };
    window.isTauriEnvironment = function() { return false; };
  ''';

  final void Function(String event, dynamic data)? onEvent;
  final Future<dynamic> Function(String method, dynamic args)? onInvoke;

  JsBridge({this.onEvent, this.onInvoke});

  String get injectionScript => _jsInject;

  void registerHandlers(InAppWebViewController controller) {
    controller.addJavaScriptHandler(
      handlerName: 'bridgeEvent',
      callback: (args) {
        if (args.isEmpty) return;
        try {
          final Map<String, dynamic> msg = jsonDecode(args[0]);
          final event = msg['event'] as String?;
          final data = msg['data'];
          if (event != null) {
            _log.i('Bridge event: $event');
            onEvent?.call(event, data);
          }
        } catch (e) {
          _log.e('Bridge event parse error: $e');
        }
      },
    );

    controller.addJavaScriptHandler(
      handlerName: 'bridgeInvoke',
      callback: (args) async {
        if (args.isEmpty) return null;
        try {
          final Map<String, dynamic> msg = jsonDecode(args[0]);
          final method = msg['method'] as String?;
          final methodArgs = msg['args'];
          if (method != null) {
            _log.i('Bridge invoke: $method');
            return await onInvoke?.call(method, methodArgs);
          }
        } catch (e) {
          _log.e('Bridge invoke error: $e');
        }
        return null;
      },
    );
  }

  Future<void> emitToWebView(
    InAppWebViewController controller,
    String event,
    dynamic data,
  ) async {
    final json = jsonEncode({'event': event, 'data': data});
    await controller.evaluateJavascript(
      source: '''
        if (window.__flutterBridge && window.__flutterBridge._handlers['$event']) {
          window.__flutterBridge._handlers['$event'](${jsonEncode(json)});
        }
      ''',
    );
  }
}
