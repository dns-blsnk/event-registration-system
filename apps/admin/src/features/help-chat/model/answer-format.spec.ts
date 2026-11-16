import { describe, expect, it } from 'vitest';

import { parseAnswer, parseInline } from './answer-format';

describe('parseInline', () => {
  it('splits bold and code from plain text', () => {
    expect(parseInline('See **Tallinn Data** at `10:00` today')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'strong', text: 'Tallinn Data' },
      { kind: 'text', text: ' at ' },
      { kind: 'code', text: '10:00' },
      { kind: 'text', text: ' today' },
    ]);
  });

  it('reads single asterisks around text as emphasis', () => {
    expect(parseInline('*(and one more)*')).toEqual([{ kind: 'emphasis', text: '(and one more)' }]);
  });

  it('leaves asterisks with spaces inside as typed, as in arithmetic', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }]);
  });

  it('leaves asterisks between words as typed', () => {
    expect(parseInline('5*3=15 and 2*4=8')).toEqual([{ kind: 'text', text: '5*3=15 and 2*4=8' }]);
  });

  it('never lets emphasis reach into a code span', () => {
    expect(parseInline('Try *x and `a*b`')).toEqual([
      { kind: 'text', text: 'Try *x and ' },
      { kind: 'code', text: 'a*b' },
    ]);
  });

  it('shows triple asterisks as bold, without stray markers', () => {
    expect(parseInline('***Note***')).toEqual([{ kind: 'strong', text: 'Note' }]);
  });

  it('leaves an unclosed marker as typed, as in a half-streamed answer', () => {
    expect(parseInline('Two **events')).toEqual([{ kind: 'text', text: 'Two **events' }]);
  });
});

describe('parseAnswer', () => {
  it('keeps line breaks inside a paragraph and starts a new one after a blank line', () => {
    expect(parseAnswer('First line\nsecond line\n\nNext')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ kind: 'text', text: 'First line' }], [{ kind: 'text', text: 'second line' }]],
      },
      { kind: 'paragraph', lines: [[{ kind: 'text', text: 'Next' }]] },
    ]);
  });

  it('reads bullet and numbered lists, however the model marks them', () => {
    const blocks = parseAnswer(
      'Found:\n*   Baltic Days\n- Riga Night\n• Tartu Day\n\n1. Book\n2) Pay',
    );

    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'list', 'list']);
    expect(blocks[1]).toMatchObject({ isOrdered: false });
    expect(blocks[1]?.kind === 'list' && blocks[1].items).toHaveLength(3);
    expect(blocks[2]).toMatchObject({ isOrdered: true });
  });

  it('shows a heading as its own line', () => {
    expect(parseAnswer('## Events')).toEqual([
      { kind: 'heading', parts: [{ kind: 'text', text: 'Events' }] },
    ]);
  });

  it('keeps the model’s numbering when a paragraph splits a numbered list', () => {
    const blocks = parseAnswer('1. Open Events\n2. Pick one\n\nThen:\n3. Publish');

    expect(blocks.at(-1)).toMatchObject({ kind: 'list', isOrdered: true, start: 3 });
  });

  it('continues a list item with the line indented under it', () => {
    expect(parseAnswer('- Baltic Days\n  in Tallinn')).toEqual([
      {
        kind: 'list',
        isOrdered: false,
        start: 1,
        items: [
          [
            { kind: 'text', text: 'Baltic Days' },
            { kind: 'text', text: ' ' },
            { kind: 'text', text: 'in Tallinn' },
          ],
        ],
      },
    ]);
  });

  it('keeps fenced code as it is, even before the fence closes', () => {
    expect(parseAnswer('```json\n{\n  "a": 1\n}\n```')).toEqual([
      { kind: 'code', text: '{\n  "a": 1\n}' },
    ]);
    expect(parseAnswer('```\n  half')).toEqual([{ kind: 'code', text: '  half' }]);
  });

  it('reads a horizontal rule as the gap between sections', () => {
    expect(parseAnswer('One\n---\nTwo').map((block) => block.kind)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  it('keeps HTML as plain text', () => {
    expect(parseAnswer('<img src=x onerror=alert(1)>')).toEqual([
      { kind: 'paragraph', lines: [[{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]] },
    ]);
  });
});
