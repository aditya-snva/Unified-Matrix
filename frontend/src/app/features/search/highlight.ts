export interface Segment {
  text: string;
  match: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Split text into plain/matched segments for safe highlighting (no innerHTML).
 * The text is trimmed to a window around the first match so long emails show the relevant part.
 */
export function highlight(text: string, query: string, maxLen = 220): Segment[] {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/^["-]+|"+$/g, '')) // strip Mongo text-search syntax
    .filter((t) => t.length > 1);

  let snippet = text.replace(/\s+/g, ' ').trim();
  if (!terms.length) return [{ text: snippet.slice(0, maxLen), match: false }];

  const re = new RegExp(`(${terms.map(escape).join('|')})`, 'gi');

  if (snippet.length > maxLen) {
    const first = snippet.search(re);
    const start = Math.max(0, (first === -1 ? 0 : first) - 60);
    snippet = (start > 0 ? '…' : '') + snippet.slice(start, start + maxLen) + (start + maxLen < snippet.length ? '…' : '');
  }

  return snippet
    .split(re)
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.some((t) => t.toLowerCase() === part.toLowerCase()) }));
}
