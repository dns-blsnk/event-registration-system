import { describe, expect, it } from 'vitest';

import { isRole, Role, ROLES } from './roles.js';

describe('roles', () => {
  it('lists every role exactly once', () => {
    expect(ROLES).toEqual(['ADMIN', 'ORGANIZER', 'CUSTOMER']);
  });

  it.each(ROLES)('accepts %s as a role', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each(['admin', 'SUPERUSER', '', 42, null, undefined, {}])('rejects %p', (value) => {
    expect(isRole(value)).toBe(false);
  });

  it('exposes role constants equal to their names', () => {
    expect(Role.ADMIN).toBe('ADMIN');
  });
});
