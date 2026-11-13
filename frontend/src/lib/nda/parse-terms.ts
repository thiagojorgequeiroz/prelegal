import type { Block, Run } from "./model";

/**
 * Parses the Common Paper Standard Terms markdown into template blocks.
 *
 * Only the handful of constructs the template actually uses are supported:
 * `#` headings, numbered paragraphs, `**bold**`, `[links](url)` and
 * `<span class="coverpage_link">Term</span>` references to Cover Page terms.
 *
 * The terms are kept verbatim (the Cover Page states they are identical to the
 * published version), so a Cover Page reference becomes a bold defined term.
 */
export function parseTerms(markdown: string): Block[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(parseBlock);
}

function parseBlock(chunk: string): Block {
  const heading = /^(#{1,3})\s+(.*)$/.exec(chunk);
  if (heading) {
    return { kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] };
  }

  const numbered = /^(\d+)\.\s+([\s\S]*)$/.exec(chunk);
  if (numbered) {
    return { kind: "numbered", number: numbered[1], runs: parseInline(numbered[2]) };
  }

  return { kind: "paragraph", runs: parseInline(chunk) };
}

const INLINE = /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>|\[([^\]]+)\]\(([^)]+)\)/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index) });

    const [, bold, ref, linkText, href] = match;
    const term = bold ?? ref;
    runs.push(term !== undefined ? { text: term, bold: true } : { text: linkText, href });

    last = match.index + match[0].length;
  }

  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}
