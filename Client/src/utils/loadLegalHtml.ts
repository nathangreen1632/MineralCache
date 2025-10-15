export async function loadLegalHtml(file: string): Promise<string> {
  const res = await fetch(`/legal/${file}`, { credentials: 'include' });
  const html = await res.text();
  const m = RegExp(/<body[^>]*>([\s\S]*?)<\/body>/i).exec(html);
  if (m?.[1]) return m[1];
  return html;
}
