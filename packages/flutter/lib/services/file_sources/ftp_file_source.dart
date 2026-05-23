import 'dart:async';
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
    _client.listCommand = ListCommand.list;
    await _client.connect();
  }

  @override
  Future<void> disconnect() async {
    await _client.disconnect().timeout(
      const Duration(seconds: 2),
      onTimeout: () => false,
    );
  }

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
    await tmp.writeAsBytes(const []);
    final uploaded = await _inDirectory(
      dirnameOf(path),
      () => _client.uploadFile(tmp, sRemoteName: basenameOf(path)),
    );
    if (!uploaded) {
      throw FTPConnectException('Could not create file ${basenameOf(path)}');
    }
  }

  @override
  Future<void> createFolder(String path) async {
    final created = await _inDirectory(
      dirnameOf(path),
      () => _client.makeDirectory(basenameOf(path)),
    );
    if (!created) {
      throw FTPConnectException('Could not create folder ${basenameOf(path)}');
    }
  }

  @override
  Future<void> rename(String path, String newPath) async {
    final renamed = await _inDirectory(
      dirnameOf(path),
      () => _client.rename(basenameOf(path), newPath),
    );
    if (!renamed) {
      throw FTPConnectException('Could not rename ${basenameOf(path)}');
    }
  }

  @override
  Future<void> copy(String path, String newPath) {
    throw UnsupportedError('FTP copy is not supported by ftpconnect.');
  }

  @override
  Future<void> download(String path, File localFile) async {
    await localFile.parent.create(recursive: true);
    final downloaded = await _inDirectory(
      dirnameOf(path),
      () => _client.downloadFile(basenameOf(path), localFile),
    );
    if (!downloaded) {
      throw FTPConnectException('Could not download ${basenameOf(path)}');
    }
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) async {
    final deleted = await _inDirectory(dirnameOf(path), () {
      final name = basenameOf(path);
      return isDirectory
          ? _client.deleteEmptyDirectory(name)
          : _client.deleteFile(name);
    });
    if (!deleted) {
      throw FTPConnectException('Could not delete ${basenameOf(path)}');
    }
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
      final changed = await _client.changeDirectory(path);
      if (!changed) {
        throw FTPConnectException("Couldn't change directory to $path");
      }
    }
    try {
      return await action();
    } finally {
      if (current != path) {
        await _client.changeDirectory(current);
      }
    }
  }

  int _compareEntries(FileSourceEntry a, FileSourceEntry b) {
    if (a.isDirectory != b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }
}
