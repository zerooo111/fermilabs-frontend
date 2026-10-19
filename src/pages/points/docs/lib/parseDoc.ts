/**
 * parseDoc.ts
 * Frontmatter and table of contents for the Markdown docs.
 */

export interface ParsedDoc {
  title?: string;
  description?: string;
  body: string;
  toc: { id: string; text: string }[];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Splits off the `key: "value"` frontmatter and lists the `##` headings. */
export function parseDoc(source: string): ParsedDoc {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  const meta: Record<string, string> = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const kv = /^(\w+):\s*(['"]?)(.*)\2\s*$/.exec(line);
      if (kv) meta[kv[1]] = kv[3];
    }
  }
  const body = match ? source.slice(match[0].length) : source;

  const toc: ParsedDoc['toc'] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    const heading = !inFence && /^## (.+)$/.exec(line);
    if (heading) toc.push({ id: slugify(heading[1]), text: heading[1] });
  }

  return { title: meta.title, description: meta.description, body, toc };
}
