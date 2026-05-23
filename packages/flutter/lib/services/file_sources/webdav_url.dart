String normalizeWebDavBaseUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return trimmed;

  final hasExplicitScheme = RegExp(
    r'^[a-zA-Z][a-zA-Z0-9+.-]*://',
  ).hasMatch(trimmed);
  return hasExplicitScheme ? trimmed : 'http://$trimmed';
}
