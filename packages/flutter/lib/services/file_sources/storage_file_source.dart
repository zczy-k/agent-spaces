import 'dart:io';

import 'file_source.dart';
import 'path_utils.dart';

class StorageFileSource extends FileSource {
  StorageFileSource(super.config);

  @override
  Future<void> connect() async {
    await Directory(config.rootPath).create(recursive: true);
  }

  @override
  Future<void> disconnect() async {}

  @override
  Future<List<FileSourceEntry>> list(String path) async {
    final entities = await Directory(path).list().toList();
    final entries = <FileSourceEntry>[];
    for (final entity in entities) {
      entries.add(await _entry(entity));
    }
    entries.sort((a, b) {
      if (a.isDirectory != b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return entries;
  }

  @override
  Future<void> createFile(String path) async {
    await File(path).create(recursive: true);
  }

  @override
  Future<void> createFolder(String path) async {
    await Directory(path).create(recursive: true);
  }

  @override
  Future<void> rename(String path, String newPath) async {
    if (await Directory(path).exists()) {
      await Directory(path).rename(newPath);
      return;
    }
    await File(path).rename(newPath);
  }

  @override
  Future<void> copy(String path, String newPath) async {
    if (await Directory(path).exists()) {
      await _copyDirectory(Directory(path), Directory(newPath));
      return;
    }
    await File(path).copy(newPath);
  }

  @override
  Future<void> download(String path, File localFile) async {
    await localFile.parent.create(recursive: true);
    await File(path).copy(localFile.path);
  }

  @override
  Future<void> delete(String path, {required bool isDirectory}) async {
    if (isDirectory) {
      await Directory(path).delete(recursive: true);
      return;
    }
    await File(path).delete();
  }

  @override
  Future<FileSourceEntry> stat(String path) async {
    final type = await FileSystemEntity.type(path);
    return _entry(
      type == FileSystemEntityType.directory ? Directory(path) : File(path),
    );
  }

  Future<FileSourceEntry> _entry(FileSystemEntity entity) async {
    final stat = await entity.stat();
    return FileSourceEntry(
      name: localBasename(entity.path),
      path: entity.path,
      isDirectory: stat.type == FileSystemEntityType.directory,
      size: stat.type == FileSystemEntityType.file ? stat.size : null,
      modifiedAt: stat.modified,
    );
  }

  Future<void> _copyDirectory(Directory source, Directory target) async {
    await target.create(recursive: true);
    await for (final entity in source.list()) {
      final nextPath = joinLocalPath(target.path, localBasename(entity.path));
      if (entity is Directory) {
        await _copyDirectory(entity, Directory(nextPath));
      } else if (entity is File) {
        await entity.copy(nextPath);
      }
    }
  }
}
