import 'dart:io';

String joinRemotePath(String parent, String name) {
  if (parent.isEmpty || parent == '/') return '/$name';
  return '${parent.replaceAll(RegExp(r'/+$'), '')}/$name';
}

String joinLocalPath(String parent, String name) {
  if (parent.endsWith(Platform.pathSeparator)) return '$parent$name';
  return '$parent${Platform.pathSeparator}$name';
}

String localBasename(String path) {
  final normalized = path.replaceAll('\\', '/').replaceAll(RegExp(r'/+$'), '');
  if (normalized.isEmpty) return path;
  return normalized.split('/').last;
}

String basenameOf(String path) {
  final normalized = path.replaceAll(RegExp(r'/+$'), '');
  if (normalized.isEmpty || normalized == '/') return '/';
  return normalized.split('/').last;
}

String dirnameOf(String path) {
  final normalized = path.replaceAll(RegExp(r'/+$'), '');
  final index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.substring(0, index);
}

String ensureTrailingSlash(String path) => path.endsWith('/') ? path : '$path/';
