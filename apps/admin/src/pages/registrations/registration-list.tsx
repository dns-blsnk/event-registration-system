import { List } from '@refinedev/mui';

import { FILL_LIST_PROPS } from '../../components/page-fill';

import { RegistrationTable } from './registration-table';

/** Registrations of the user's events, admins all of them, with filters kept in the URL. */
export function RegistrationList(): React.JSX.Element {
  return (
    <List {...FILL_LIST_PROPS}>
      <RegistrationTable />
    </List>
  );
}
