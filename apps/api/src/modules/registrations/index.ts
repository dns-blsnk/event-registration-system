/** What other modules may use from this one; everything else here is internal. */
export { registrationScope } from './registration-scope.js';
export { promoteFromWaitlist } from './waitlist.js';
export { MyRegistrationsService } from './my/my-registrations.service.js';
export { RegistrationsService } from './registrations.service.js';
export type { RegistrationFilters } from './registrations.service.js';
export { toRegistrationListItem } from './registration-view.js';
export type { RegistrationWithRelations } from './registration-view.js';
