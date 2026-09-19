/**
 * Text helpers for notification plugins.
 *
 * Chat channels cap message length (Telegram 4096, Discord 2000, WeCom 4096
 * bytes), so a rendered report must be split before sending or the API rejects
 * the whole payload.
 */

/**
 * Split text into chunks no longer than `limit` characters, preferring breaks
 * at paragraph boundaries and hard-splitting a single overlong line.
 */
export function splitText(text: string, limit: number): string[] {
  if (limit < 1) throw new Error(`chunk limit must be positive, got ${limit}`);
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    if (line.length > limit) {
      if (current !== "") {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
      continue;
    }

    if (current.length + line.length + 1 > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = current === "" ? line : `${current}\n${line}`;
    }
  }

  if (current !== "") chunks.push(current);
  return chunks;
}
