import 'dart:io';

import 'package:ftpconnect/ftpconnect.dart';

import 'file_source.dart';
import 'path_utils.dart';

class FtpFileSource extends FileSource {
  FtpFileSource(super.config);

  late final FTPConnect _client;

  @override
  Future<void> connect() async {
    _client = FTPConnect(
      config.host,
      port: config.port == 0 ? 21 : config.port,
      user: config.username,
      pass: config.password,
    );
    await _client.connect();
  }

  @override
  Future<void> disconnect() => _client.disconnect();

  @override
  Future<List<FileSourceEntry>> list(String path) async {
    return _inDirectory(path, () async {
      final entries = await _client.listDirectoryContent();
      return entries
          .where((entry) => entry.name != '.' && entry.name != '..')
          .map(
            (entry) => FileSourceEntry(
              name: entry.name,
              path: joinRemotePath(path, entry.name),
              isDirectory: entry.type == FTPEntryType.dir,
              size: entry.size,
              modifiedAt: entry.modifyTime,
            ),
          )
          .toList()
        ..sort(_compareEntries);
    });
  }

  @override
  Future<void> createFile(String path) async {
    final tmp = await File(
      '${Directory.systemTemp.path}/agent_spaces_empty_file',
    ).create();
    await _inDirectory(
      dirnameOf(path),
      () => _client.uploadFile(tmp, sRemoteName: basenameOf(path)),
    );
  }

  @override
  Future<void> createFolder(String path) {
    return _inDirectory(
      dirnameOf(path),
      () => _client.makeDirectory(basenameOf(path)),
    );
  }

  @override
  Future<void> rename(String path, String newPath) {
    return _inDirectory(
      dirnameOf(path),
      () => _client.rename(basenameOf(path), newPath),
    );
  }

  @override
  Future<void> copy(String path, String newPath) {
    throw UnsupportedError('FTP copy is not supported by ftpconnect.');
  }

  @override
  Future<void> download(String path, File localFile) async {
    await localFile.parent.create(recursive: true);
    await _inDirectory(
      dirnameOf(path),
      () => _client.downloadFile(basenameOf(path), localFile),
    );
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) {
    return _inDirectory(dirnameOf(path), () {
      final name = basenameOf(path);
      return isDirectory
          ? _client.deleteDirectory(name)
          : _client.deleteFile(name);
    });
  }

  @override
  Future<FileSourceEntry> stat(String path) async {
    final parent = dirnameOf(path);
    final name = basenameOf(path);
    final entries = await list(parent);
    return entries.firstWhere((entry) => entry.name == name);
  }

  Future<T> _inDirectory<T>(String path, Future<T> Function() action) async {
    final current = await _client.currentDirectory();
    if (path.isNotEmpty && path != current) {
      await _client.changeDirectory(path);
    }
    try {
      return await action();
    } finally {
      await _client.changeDirectory(current);
    }
  }

  int _compareEntries(FileSourceEntry a, FileSourceEntry b) {
    if (a.isDirectory != b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }
}
