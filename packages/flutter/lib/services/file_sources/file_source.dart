import 'dart:io';

import '../../models/file_source_config.dart';

class FileSourceEntry {
  final String name;
  final String path;
  final bool isDirectory;
  final int? size;
  final DateTime? modifiedAt;

  const FileSourceEntry({
    required this.name,
    required this.path,
    required this.isDirectory,
    this.size,
    this.modifiedAt,
  });
}

abstract class FileSource {
  FileSource(this.config);

  final FileSourceConfig config;

  Future<void> connect();

  Future<void> disconnect();

  Future<List<FileSourceEntry>> list(String path);

  Future<void> createFile(String path);

  Future<void> createFolder(String path);

  Future<void> rename(String path, String newPath);

  Future<void> copy(String path, String newPath);

  Future<void> move(String path, String newPath) => rename(path, newPath);

  Future<void> download(String path, File localFile);

  Future<void> delete(String path, {required bool isDirectory});

  Future<FileSourceEntry> stat(String path);
}
