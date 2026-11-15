import { describe, expect, it } from 'vitest';

import { toUserCreatePayload, toUserFormValues, toUserPatch } from './user-form-values';

import type { UserListItem } from '@ers/shared';

const user: UserListItem = {
  id: 'u1',
  email: 'ann@demo.test',
  name: 'Ann',
  role: 'CUSTOMER',
  createdAt: '2026-11-01T09:00:00Z',
};

describe('user form values', () => {
  it('builds a create payload with trimmed email and name and the password as typed', () => {
    expect(
      toUserCreatePayload({
        email: ' ann@demo.test ',
        name: ' Ann ',
        role: 'ORGANIZER',
        password: ' secret pass ',
      }),
    ).toEqual({
      email: 'ann@demo.test',
      name: 'Ann',
      role: 'ORGANIZER',
      password: ' secret pass ',
    });
  });

  it('patches only the name or role that changed', () => {
    const original = toUserFormValues(user);

    expect(toUserPatch(original, original)).toEqual({});
    expect(toUserPatch({ ...original, role: 'ORGANIZER' }, original)).toEqual({
      role: 'ORGANIZER',
    });
    expect(toUserPatch({ ...original, name: ' Anna ' }, original)).toEqual({ name: 'Anna' });
    expect(toUserPatch({ ...original, name: 'Ann ' }, original)).toEqual({});
  });
});
