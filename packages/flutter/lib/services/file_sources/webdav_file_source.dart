import 'dart:io' as io;

import 'package:webdav_client/webdav_client.dart' as webdav;

import 'file_source.dart';
import 'path_utils.dart';
import 'webdav_url.dart';

class WebDavFileSource extends FileSource {
  WebDavFileSource(super.config);

  late final webdav.Client _client;

  @override
  Future<void> connect() async {
    _client = webdav.newClient(
      normalizeWebDavBaseUrl(config.baseUrl),
      user: config.username,
      password: config.password,
    );
    await _withWebDavError(() => _client.ping());
  }

  @override
  Future<void> disconnect() async {}

  @override
  Future<List<FileSourceEntry>> list(String path) async {
    final files = await _withWebDavError(() => _client.readDir(path));
    return files
        .where((file) => file.name != null && file.name!.isNotEmpty)
        .map(
          (file) => FileSourceEntry(
            name: file.name!,
            path: file.path ?? joinRemotePath(path, file.name!),
            isDirectory: file.isDir ?? false,
            size: file.size,
            modifiedAt: file.mTime,
          ),
        )
        .toList()
      ..sort(_compareEntries);
  }

  @override
  Future<void> createFile(String path) async {
    final tmp = await io.File(
      '${io.Directory.systemTemp.path}/agent_spaces_empty_file',
    ).create();
    await _withWebDavError(() => _client.writeFromFile(tmp.path, path));
  }

  @override
  Future<void> createFolder(String path) =>
      _withWebDavError(() => _client.mkdirAll(path));

  @override
  Future<void> rename(String path, String newPath) =>
      _withWebDavError(() => _client.rename(path, newPath, true));

  @override
  Future<void> copy(String path, String newPath) =>
      _withWebDavError(() => _client.copy(path, newPath, true));

  @override
  Future<void> download(String path, io.File localFile) async {
    await localFile.parent.create(recursive: true);
    await _withWebDavError(() => _client.read2File(path, localFile.path));
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) {
    return _withWebDavError(
      () => _client.remove(isDirectory ? ensureTrailingSlash(path) : path),
    );
  }

  @override
  Future<FileSourceEntry> stat(String path) async {
    final parent = dirnameOf(path);
    final name = basenameOf(path);
    final entries = await list(parent);
    return entries.firstWhere((entry) => entry.name == name);
  }

  int _compareEntries(FileSourceEntry a, FileSourceEntry b) {
    if (a.isDirectory != b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }

  Future<T> _withWebDavError<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (error) {
      throw WebDavFileSourceException.from(error, config.baseUrl);
    }
  }
}

class WebDavFileSourceException implements Exception {
  const WebDavFileSourceException(this.message);

  final String message;

  factory WebDavFileSourceException.from(Object error, String baseUrl) {
    final normalizedBaseUrl = normalizeWebDavBaseUrl(baseUrl);
    final dioDetails = _DioErrorDetails.tryParse(error);
    if (dioDetails == null) {
      return WebDavFileSourceException(error.toString());
    }

    final statusLabel = [
      if (dioDetails.statusCode != null) '${dioDetails.statusCode}',
      if (dioDetails.statusMessage != null &&
          dioDetails.statusMessage!.isNotEmpty)
        dioDetails.statusMessage!,
    ].join(' ');

    if (dioDetails.method == 'PROPFIND' && dioDetails.statusCode == 200) {
      return WebDavFileSourceException(
        'WebDAV directory listing failed: PROPFIND returned 200 OK instead of 207 Multi-Status. '
        'The Base URL "$normalizedBaseUrl" appears to be a normal HTTP page, not a WebDAV endpoint. '
        'Check the WebDAV service path and port. Agent Spaces uses http://127.0.0.1:8080 for its local web assets.',
      );
    }

    if (dioDetails.statusCode == 401 || dioDetails.statusCode == 403) {
      return WebDavFileSourceException(
        'WebDAV authentication failed ($statusLabel). Check username and password.',
      );
    }

    return WebDavFileSourceException(
      'WebDAV request failed'
      '${statusLabel.isEmpty ? '' : ' ($statusLabel)'}'
      '${dioDetails.method == null ? '' : ' during ${dioDetails.method}'}'
      ': ${dioDetails.error ?? error}',
    );
  }

  @override
  String toString() => message;
}

class _DioErrorDetails {
  const _DioErrorDetails({
    this.statusCode,
    this.statusMessage,
    this.method,
    this.error,
  });

  final int? statusCode;
  final String? statusMessage;
  final String? method;
  final Object? error;

  static _DioErrorDetails? tryParse(Object error) {
    final dynamic dynamicError = error;
    try {
      final dynamic response = dynamicError.response;
      if (response == null) return null;
      final dynamic requestOptions = response.requestOptions;
      return _DioErrorDetails(
        statusCode: response.statusCode as int?,
        statusMessage: response.statusMessage as String?,
        method: (requestOptions.method as String?)?.toUpperCase(),
        error: dynamicError.error,
      );
    } catch (_) {
      return null;
    }
  }
}
