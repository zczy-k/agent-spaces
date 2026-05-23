import 'package:agent_spaces/services/file_sources/webdav_url.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeWebDavBaseUrl', () {
    test('adds http scheme to host and port values', () {
      expect(normalizeWebDavBaseUrl('127.0.0.1:8080'), 'http://127.0.0.1:8080');
      expect(normalizeWebDavBaseUrl('localhost:8080'), 'http://localhost:8080');
    });

    test('preserves explicit schemes', () {
      expect(
        normalizeWebDavBaseUrl('https://example.com/webdav'),
        'https://example.com/webdav',
      );
      expect(
        normalizeWebDavBaseUrl('http://example.com/webdav'),
        'http://example.com/webdav',
      );
    });

    test('trims surrounding whitespace', () {
      expect(
        normalizeWebDavBaseUrl('  example.com/webdav  '),
        'http://example.com/webdav',
      );
    });
  });
}
