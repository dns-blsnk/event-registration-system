/**
 * A small subset of Markdown, the formatting the model writes: paragraphs with line breaks, bullet
 * and numbered lists, headings, fenced code, **bold** and `code`. Everything else stays plain
 * text, HTML included: the result is rendered as React text, never as markup.
 */

export interface InlinePart {
  kind: 'text' | 'strong' | 'code';
  text: string;
}

export type AnswerBlock =
  | { kind: 'paragraph'; lines: InlinePart[][] }
  | { kind: 'heading'; parts: InlinePart[] }
  /** `start` keeps the model's numbering when a numbered list is split by a paragraph. */
  | { kind: 'list'; isOrdered: boolean; start: number; items: InlinePart[][] }
  | { kind: 'code'; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s{0,3}```/;
/** A line indented under a list item continues that item. */
const INDENTED = /^\s{2,}\S/;
/** `**bold**` or `code`, the only inline formatting kept; unclosed markers stay as typed. */
const INLINE = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;

/** A line's text split into plain, bold and code parts. */
export function parseInline(line: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let rest = 0;
  for (const match of line.matchAll(INLINE)) {
    if (match.index > rest) parts.push({ kind: 'text', text: line.slice(rest, match.index) });
    const [whole, strong, code] = match;
    parts.push(
      strong === undefined ? { kind: 'code', text: code ?? '' } : { kind: 'strong', text: strong },
    );
    rest = match.index + whole.length;
  }
  if (rest < line.length) parts.push({ kind: 'text', text: line.slice(rest) });
  return parts;
}

type LineKind =
  | { kind: 'blank' | 'fence' }
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string; isIndented: boolean }
  | { kind: 'item'; isOrdered: boolean; number: number; text: string };

function classify(line: string): LineKind {
  // A rule only separates sections; it reads as the gap a blank line leaves.
  if (line.trim() === '' || RULE.test(line)) return { kind: 'blank' };
  if (FENCE.test(line)) return { kind: 'fence' };
  const heading = HEADING.exec(line)?.[1];
  if (heading !== undefined) return { kind: 'heading', text: heading };
  const bullet = BULLET.exec(line)?.[1];
  if (bullet !== undefined) return { kind: 'item', isOrdered: false, number: 1, text: bullet };
  const numbered = NUMBERED.exec(line);
  if (numbered !== null) {
    return { kind: 'item', isOrdered: true, number: Number(numbered[1]), text: numbered[2] ?? '' };
  }
  return { kind: 'text', text: line, isIndented: INDENTED.test(line) };
}

/** A list item joins the list just before it if that list is of the same kind. */
function addItem(blocks: AnswerBlock[], line: Extract<LineKind, { kind: 'item' }>): void {
  const last = blocks.at(-1);
  if (last?.kind === 'list' && last.isOrdered === line.isOrdered) {
    last.items.push(parseInline(line.text));
    return;
  }
  const { isOrdered, number } = line;
  blocks.push({ kind: 'list', isOrdered, start: number, items: [parseInline(line.text)] });
}

/**
 * A text line continues the paragraph just before it, or the list item it is indented under,
 * unless a blank line came between; otherwise it starts a paragraph.
 */
function addText(
  blocks: AnswerBlock[],
  line: Extract<LineKind, { kind: 'text' }>,
  afterBlank: boolean,
) {
  const last = blocks.at(-1);
  const item =
    last?.kind === 'list' && line.isIndented && !afterBlank ? last.items.at(-1) : undefined;
  if (item !== undefined) {
    item.push({ kind: 'text', text: ' ' }, ...parseInline(line.text.trim()));
  } else if (last?.kind === 'paragraph' && !afterBlank) {
    last.lines.push(parseInline(line.text));
  } else {
    blocks.push({ kind: 'paragraph', lines: [parseInline(line.text)] });
  }
}

function addLine(blocks: AnswerBlock[], line: LineKind, afterBlank: boolean): void {
  switch (line.kind) {
    case 'blank':
    case 'fence':
      return;
    case 'heading':
      blocks.push({ kind: 'heading', parts: parseInline(line.text) });
      return;
    case 'item':
      addItem(blocks, line);
      return;
    case 'text':
      addText(blocks, line, afterBlank);
  }
}

/**
 * The answer as blocks to render; also works on a half-streamed answer, where a code block not
 * closed yet shows what arrived so far.
 */
export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let afterBlank = false;
  let code: string[] | undefined;
  for (const raw of text.split('\n')) {
    if (code !== undefined) {
      if (FENCE.test(raw)) {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = undefined;
      } else {
        code.push(raw);
      }
      continue;
    }
    const line = classify(raw);
    if (line.kind === 'fence') code = [];
    addLine(blocks, line, afterBlank);
    afterBlank = line.kind === 'blank';
  }
  if (code !== undefined) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}
