import { describe, expect, it } from 'vitest';

import { assignableRoles, roleChangeRefusal, userManagementRefusal } from './user-management.js';

describe('assignableRoles', () => {
  it('lets a super admin give any role', () => {
    expect(assignableRoles('SUPER_ADMIN')).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'ORGANIZER',
      'CUSTOMER',
    ]);
  });

  it('lets an admin give only organizer and customer roles', () => {
    expect(assignableRoles('ADMIN')).toEqual(['ORGANIZER', 'CUSTOMER']);
  });

  it.each(['ORGANIZER', 'CUSTOMER'] as const)('lets %s give no role', (role) => {
    expect(assignableRoles(role)).toEqual([]);
  });
});

describe('userManagementRefusal', () => {
  it.each(['ORGANIZER', 'CUSTOMER'] as const)('lets an admin manage a %s', (target) => {
    expect(userManagementRefusal('ADMIN', target)).toBeUndefined();
  });

  it.each(['ADMIN', 'SUPER_ADMIN'] as const)('keeps an admin away from a %s', (target) => {
    expect(userManagementRefusal('ADMIN', target)).toBe(
      'Only a super admin can change or delete an admin',
    );
  });

  it.each(['SUPER_ADMIN', 'ADMIN', 'ORGANIZER', 'CUSTOMER'] as const)(
    'lets a super admin manage a %s',
    (target) => {
      expect(userManagementRefusal('SUPER_ADMIN', target)).toBeUndefined();
    },
  );

  it('refuses anyone without admin powers', () => {
    expect(userManagementRefusal('ORGANIZER', 'CUSTOMER')).toBe('Only admins manage users');
  });
});

describe('roleChangeRefusal', () => {
  it('does not let an admin promote an organizer to admin', () => {
    expect(roleChangeRefusal('ADMIN', 'ORGANIZER', 'ADMIN')).toBe(
      'Only a super admin can grant an admin role',
    );
  });

  it('lets an admin turn a customer into an organizer', () => {
    expect(roleChangeRefusal('ADMIN', 'CUSTOMER', 'ORGANIZER')).toBeUndefined();
  });

  it('lets a super admin demote an admin', () => {
    expect(roleChangeRefusal('SUPER_ADMIN', 'ADMIN', 'ORGANIZER')).toBeUndefined();
  });
});
