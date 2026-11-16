import type { Role, UserListItem } from '@ers/shared';

/** What the user form edits; email and password only matter when creating. */
export interface UserFormValues {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface UserCreatePayload {
  email: string;
  name: string;
  role: Role;
  password: string;
}

/** Email is the login and the password belongs to the user, so an edit changes only these. */
export interface UserPatch {
  name?: string;
  role?: Role;
}

export const EMPTY_USER_FORM: UserFormValues = {
  email: '',
  name: '',
  role: 'CUSTOMER',
  password: '',
};

export function toUserFormValues(user: UserListItem): UserFormValues {
  return { email: user.email, name: user.name, role: user.role, password: '' };
}

export function toUserCreatePayload(values: UserFormValues): UserCreatePayload {
  return {
    email: values.email.trim(),
    name: values.name.trim(),
    role: values.role,
    password: values.password,
  };
}

/** Only what changed, compared the way the API stores it (trimmed), so a no-op sends nothing. */
export function toUserPatch(values: UserFormValues, original: UserFormValues): UserPatch {
  const patch: UserPatch = {};
  const name = values.name.trim();
  if (name !== original.name) patch.name = name;
  if (values.role !== original.role) patch.role = values.role;
  return patch;
}
