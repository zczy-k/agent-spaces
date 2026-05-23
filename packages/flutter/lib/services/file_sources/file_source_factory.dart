import '../../models/file_source_config.dart';
import 'file_source.dart';
import 'ftp_file_source.dart';
import 'sftp_file_source.dart';
import 'storage_file_source.dart';
import 'webdav_file_source.dart';

FileSource createFileSource(FileSourceConfig config) {
  return switch (config.type) {
    FileSourceType.sftp => SftpFileSource(config),
    FileSourceType.ftp => FtpFileSource(config),
    FileSourceType.storage => StorageFileSource(config),
    FileSourceType.webdav => WebDavFileSource(config),
  };
}
