import { Role, type PublicUser } from '@ers/shared';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useGetIdentity } from '@refinedev/core';

import { CustomerDashboard } from './customer-dashboard';
import { StaffDashboard } from './staff-dashboard';

/** The home page: a dashboard for the signed-in role, so each role starts where its work is. */
export function DashboardPage(): React.JSX.Element | null {
  const { data: user } = useGetIdentity<PublicUser>();
  if (user === undefined) return null;
  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h1">
          Welcome, {user.name}
        </Typography>
        {user.role === Role.CUSTOMER ? <CustomerDashboard /> : <StaffDashboard role={user.role} />}
      </Stack>
    </Card>
  );
}
