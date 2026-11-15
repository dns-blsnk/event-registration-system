import { describe, expect, it } from 'vitest';

import { emailColumn, mailtoHref } from './email-column';

describe('mailtoHref', () => {
  it('links to the address as it is', () => {
    expect(mailtoHref('ann@demo.test')).toBe('mailto:ann@demo.test');
  });

  it('encodes a local part that would otherwise be read as mail headers', () => {
    expect(mailtoHref('a?b#c@demo.test')).toBe('mailto:a%3Fb%23c@demo.test');
  });
});

describe('emailColumn', () => {
  it('sorts by the address unless the API cannot', () => {
    const emailOf = (row: { email: string }): string => row.email;

    expect(emailColumn({ field: 'email', headerName: 'Email', emailOf }).sortable).toBe(true);
    expect(
      emailColumn({ field: 'email', headerName: 'Email', emailOf, isSortable: false }).sortable,
    ).toBe(false);
  });
});
