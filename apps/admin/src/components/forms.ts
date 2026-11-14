/** The message every required field shows when left empty. */
export const REQUIRED = 'Required';

/** Required text that is more than blanks; the API trims text, so blanks would fail there anyway. */
export const REQUIRED_TEXT = {
  validate: (value: string): true | string => value.trim() !== '' || REQUIRED,
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
