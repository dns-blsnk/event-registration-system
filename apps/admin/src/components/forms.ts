/**
 * Refine's `onFinish` rejects after it has already shown the failure: field errors on the inputs
 * and a notification. The form has nothing more to do, so the rejection ends here on purpose.
 */
export function errorShownByRefine(): undefined {
  return undefined;
}
