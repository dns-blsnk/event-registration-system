import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useList, type CrudFilter } from '@refinedev/core';
import { Link as RouterLink } from 'react-router';

import { TINT } from '../../theme/tokens';

import type { StatusColor } from '../../theme/status-colors';

interface StatTileProps {
  label: string;
  icon: React.ReactNode;
  resource: string;
  filters: CrudFilter[];
  /** Where a click goes: the list behind the number. */
  to: string;
  color: Exclude<StatusColor, 'default'>;
}

/**
 * One number for the dashboard, counted by the list endpoint itself (a one-row page and its
 * total), so the tile and the list it opens always agree.
 */
export function StatTile({
  label,
  icon,
  resource,
  filters,
  to,
  color,
}: StatTileProps): React.JSX.Element {
  const { result, query } = useList({
    resource,
    filters,
    pagination: { currentPage: 1, pageSize: 1 },
    errorNotification: false,
  });
  return (
    <Card sx={{ flex: '1 1 200px' }}>
      <CardActionArea component={RouterLink} to={to} sx={{ p: 2, height: '100%' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Stack
            sx={(theme) => ({
              p: 1.25,
              borderRadius: 2,
              color: theme.palette[color].main,
              bgcolor: alpha(theme.palette[color].main, TINT.soft),
            })}
          >
            {icon}
          </Stack>
          <div>
            <Typography variant="h5" component="p">
              {query.isLoading ? <Skeleton width={40} /> : (result.total ?? 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </div>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
