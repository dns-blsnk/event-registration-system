import { Resource, type MyRegistration } from '@ers/shared';
import { useCustomMutation, useInvalidate, useNotification } from '@refinedev/core';

/** The booking to cancel and the event page whose seat counts it changes. */
export interface BookingRef {
  registrationId: string;
  eventId: string;
}

/**
 * Cancels the signed-in customer's own booking. A freed seat goes to the waitlist at once, so the
 * customer's list and the catalog's seat counts are both reloaded.
 */
export function useCancelBooking(): {
  cancel: (booking: BookingRef, notice?: string) => void;
  isPending: boolean;
  isDone: boolean;
} {
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const { mutate, mutation } = useCustomMutation<MyRegistration>({
    mutationOptions: {
      // On the mutation itself, not on one call: an Undo clicked after leaving the page still
      // refreshes the lists. Every catalog page is reloaded, as the freed seat shows in all of them.
      // Refine lets this replace its own onSuccess, so the success notice is shown here too.
      onSuccess: (_data, { successNotification }) => {
        if (typeof successNotification === 'object') open?.(successNotification);
        void invalidate({ resource: Resource.MY_REGISTRATIONS, invalidates: ['list'] });
        void invalidate({ resource: Resource.CATALOG, invalidates: ['resourceAll'] });
      },
    },
  });
  const cancel = ({ registrationId }: BookingRef, notice = 'Booking cancelled'): void => {
    mutate({
      url: `/my-registrations/${registrationId}/cancel`,
      method: 'post',
      values: {},
      successNotification: { type: 'success', message: notice },
    });
  };
  return { cancel, isPending: mutation.isPending, isDone: mutation.isSuccess };
}
