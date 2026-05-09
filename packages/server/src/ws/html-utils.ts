export function stripHtml(content: string): string {
  return content
    .replace(/<span[^>]*data-type=["']mention["'][^>]*data-label=["']([^"']+)["'][^>]*><\/span>/gi, '@$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMentionIds(content: string): string[] {
  const ids = new Set<string>();
  const mentionPattern = /<span[^>]*data-type=["']mention["'][^>]*>/gi;
  for (const match of content.matchAll(mentionPattern)) {
    const id = match[0].match(/\sdata-id=["']([^"']+)["']/i)?.[1];
    if (id) ids.add(decodeHtml(id));
  }
  return [...ids];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
