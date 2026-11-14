import { errorShownByRefine } from '../../components/forms';

import type { EventFormValues, EventPayload } from './event-form-values';

/**
 * Sends a converted payload through Refine's onFinish. The form edits local dates and tag objects
 * while the API takes ISO dates and tag ids, so the payload is not the form's own value type.
 */
export async function submitEventPayload(
  onFinish: (values: EventFormValues) => Promise<unknown>,
  payload: Partial<EventPayload>,
): Promise<void> {
  await onFinish(payload as unknown as EventFormValues).catch(errorShownByRefine);
}
