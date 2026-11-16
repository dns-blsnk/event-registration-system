import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnswerText } from './answer-text';

describe('AnswerText', () => {
  it('shows lists as lists and bold as bold', () => {
    render(<AnswerText text={'Two events:\n* **Baltic Days**, 20 Nov\n* Riga Night'} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Baltic Days').tagName).toBe('STRONG');
  });

  it('shows markup from the model as text, never as elements', () => {
    const { container } = render(<AnswerText text={'<img src=x onerror=alert(1)> **ok**'} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
  });

  it('shows headings as headings and numbered lists from the model’s number', () => {
    render(<AnswerText text={'## Steps\n3. Publish'} />);

    expect(screen.getByRole('heading', { name: 'Steps' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveAttribute('start', '3');
  });
});
