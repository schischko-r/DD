export function decodeHtmlPageContent(contentBase64) {
  if (!contentBase64 || typeof atob !== 'function') return '';
  const bytes = Uint8Array.from(atob(contentBase64), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function prepareHtmlPageSource(content, baseHref) {
  if (!content) return '';
  const base = `<base href="${escapeAttribute(baseHref)}">`;
  if (/<head(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${base}`);
  }
  return `${base}${content}`;
}
