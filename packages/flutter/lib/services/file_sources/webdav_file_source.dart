import 'dart:io' as io;

import 'package:webdav_client/webdav_client.dart' as webdav;

import 'file_source.dart';
import 'path_utils.dart';

class WebDavFileSource extends FileSource {
  WebDavFileSource(super.config);

  late final webdav.Client _client;

  @override
  Future<void> connect() async {
    _client = webdav.newClient(
      config.baseUrl,
      user: config.username,
      password: config.password,
    );
    await _client.ping();
  }

  @override
  Future<void> disconnect() async {}

  @override
  Future<List<FileSourceEntry>> list(String path) async {
    final files = await _client.readDir(path);
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
    await _client.writeFromFile(tmp.path, path);
  }

  @override
  Future<void> createFolder(String path) => _client.mkdirAll(path);

  @override
  Future<void> rename(String path, String newPath) =>
      _client.rename(path, newPath, true);

  @override
  Future<void> copy(String path, String newPath) =>
      _client.copy(path, newPath, true);

  @override
  Future<void> download(String path, io.File localFile) async {
    await localFile.parent.create(recursive: true);
    await _client.read2File(path, localFile.path);
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) {
    return _client.remove(isDirectory ? ensureTrailingSlash(path) : path);
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
}
