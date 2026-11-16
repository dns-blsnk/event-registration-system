import { canCustomerCancel, type MyRegistration } from '@ers/shared';

/** Whether the Cancel button is offered: the shared customer rule on this booking's session. */
export function canCancel(registration: MyRegistration, now: Date): boolean {
  const session = {
    startsAt: new Date(registration.session.startsAt),
    endsAt: new Date(registration.session.endsAt),
  };
  return canCustomerCancel(registration, session, now);
}
