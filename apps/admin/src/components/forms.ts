import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from '@ers/shared';

const PASSWORD_TOO_LONG_MESSAGE = `Too long: use at most ${String(PASSWORD_MAX_LENGTH)} characters`;

/** The message every required field shows when left empty. */
export const REQUIRED = 'Required';

/** Required text that is more than blanks; the API trims text, so blanks would fail there anyway. */
export const REQUIRED_TEXT = {
  validate: (value: string): true | string => value.trim() !== '' || REQUIRED,
};

/**
 * A quick shape check (something@something.tld) for faster feedback; the API's email validation
 * stays the authority.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_RULES = {
  validate: (value: string): true | string => {
    const email = value.trim();
    if (email === '') return REQUIRED;
    return EMAIL_SHAPE.test(email) || 'Enter an email address like name@example.com';
  },
};

/** A new password: required and at least the shared minimum; the API checks the maximum too. */
export const NEW_PASSWORD_RULES = {
  required: REQUIRED,
  minLength: { value: PASSWORD_MIN_LENGTH, message: PASSWORD_TOO_SHORT_MESSAGE },
  // Checked, not cut off: a truncated pasted password would no longer match the one the user saved.
  maxLength: { value: PASSWORD_MAX_LENGTH, message: PASSWORD_TOO_LONG_MESSAGE },
};

/** Helper text: the error when there is one, otherwise the shared description of the field. */
export function fieldHelp(error: { message?: string } | undefined, description: string): string {
  return error?.message ?? description;
}

/**
 * Refine's `onFinish` rejects after it has already shown the failure: field errors on the inputs
 * and a notification. The form has nothing more to do, so the rejection ends here on purpose.
 */
export function errorShownByRefine(): undefined {
  return undefined;
}

/**
 * Sends a converted payload through Refine's onFinish. Forms edit local dates and picked objects
 * while the API takes ISO dates and ids, so the payload is not the form's own value type.
 */
export async function submitConverted(
  onFinish: (values: never) => Promise<unknown>,
  payload: object,
): Promise<void> {
  await onFinish(payload as never).catch(errorShownByRefine);
}
