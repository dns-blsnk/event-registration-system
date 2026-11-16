import { describe, expect, it } from 'vitest';

import { listUrl } from './list-url';

describe('listUrl', () => {
  it('puts each filter in the shape Refine reads from the URL', () => {
    expect(decodeURIComponent(listUrl('/events', { city: 'Tallinn' }))).toBe(
      '/events?filters[0][field]=city&filters[0][operator]=eq&filters[0][value]=Tallinn',
    );
  });

  it('encodes values, so one cannot add parameters of its own', () => {
    const url = listUrl('/events', { city: 'Tallinn&filters[1][field]=organizerId#x' });

    expect(new URL(url, 'http://admin').searchParams.get('filters[0][value]')).toBe(
      'Tallinn&filters[1][field]=organizerId#x',
    );
    expect([...new URL(url, 'http://admin').searchParams.keys()]).toHaveLength(3);
  });

  it('is the bare path without filters', () => {
    expect(listUrl('/customers', {})).toBe('/customers');
  });
});
