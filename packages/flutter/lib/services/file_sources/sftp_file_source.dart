import 'dart:io';
import 'dart:typed_data';

import 'package:dartssh2/dartssh2.dart';

import 'file_source.dart';
import 'path_utils.dart';

class SftpFileSource extends FileSource {
  SftpFileSource(super.config);

  SSHClient? _ssh;
  SftpClient? _sftp;

  @override
  Future<void> connect() async {
    await disconnect();

    final ssh = SSHClient(
      await SSHSocket.connect(config.host, config.port == 0 ? 22 : config.port),
      username: config.username,
      onPasswordRequest: () => config.password,
    );
    _ssh = ssh;
    _sftp = await ssh.sftp();
  }

  @override
  Future<void> disconnect() async {
    _sftp?.close();
    _ssh?.close();
    _sftp = null;
    _ssh = null;
  }

  @override
  Future<List<FileSourceEntry>> list(String path) async {
    final names = await _client.listdir(path);
    return names
        .where((name) => name.filename != '.' && name.filename != '..')
        .map(
          (name) => FileSourceEntry(
            name: name.filename,
            path: joinRemotePath(path, name.filename),
            isDirectory: name.attr.isDirectory,
            size: name.attr.size,
            modifiedAt: _dateFromSeconds(name.attr.modifyTime),
          ),
        )
        .toList()
      ..sort(_compareEntries);
  }

  @override
  Future<void> createFile(String path) async {
    final file = await _client.open(
      path,
      mode:
          SftpFileOpenMode.create |
          SftpFileOpenMode.write |
          SftpFileOpenMode.truncate,
    );
    await file.close();
  }

  @override
  Future<void> createFolder(String path) => _client.mkdir(path);

  @override
  Future<void> rename(String path, String newPath) =>
      _client.rename(path, newPath);

  @override
  Future<void> copy(String path, String newPath) async {
    final source = await _client.open(path, mode: SftpFileOpenMode.read);
    final target = await _client.open(
      newPath,
      mode:
          SftpFileOpenMode.create |
          SftpFileOpenMode.write |
          SftpFileOpenMode.truncate,
    );
    try {
      final writer = target.write(source.read());
      await writer.done;
    } finally {
      await source.close();
      await target.close();
    }
  }

  @override
  Future<void> upload(File localFile, String path) async {
    final target = await _client.open(
      path,
      mode:
          SftpFileOpenMode.create |
          SftpFileOpenMode.write |
          SftpFileOpenMode.truncate,
    );
    try {
      final writer = target.write(localFile.openRead().map(Uint8List.fromList));
      await writer.done;
    } finally {
      await target.close();
    }
  }

  @override
  Future<void> download(String path, File localFile) async {
    await localFile.parent.create(recursive: true);
    final sink = localFile.openWrite();
    await _client.download(path, sink, closeDestination: true);
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) {
    return isDirectory ? _client.rmdir(path) : _client.remove(path);
  }

  @override
  Future<FileSourceEntry> stat(String path) async {
    final stat = await _client.stat(path);
    return FileSourceEntry(
      name: basenameOf(path),
      path: path,
      isDirectory: stat.isDirectory,
      size: stat.size,
      modifiedAt: _dateFromSeconds(stat.modifyTime),
    );
  }

  SftpClient get _client {
    final client = _sftp;
    if (client == null) throw StateError('SFTP is not connected.');
    return client;
  }

  DateTime? _dateFromSeconds(int? seconds) {
    return seconds == null
        ? null
        : DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
  }

  int _compareEntries(FileSourceEntry a, FileSourceEntry b) {
    if (a.isDirectory != b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  }
}
