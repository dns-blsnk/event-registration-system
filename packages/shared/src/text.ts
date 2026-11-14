/** How labels such as tag names are stored: trimmed, with inner runs of whitespace as one space. */
export function normalizeLabel(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
