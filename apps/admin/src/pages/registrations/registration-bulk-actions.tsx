import {
  RegistrationStatus,
  Resource,
  type BulkStatusResponse,
  type BulkTargetStatus,
  type RegistrationListItem,
} from '@ers/shared';
import Button, { type ButtonProps } from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCustomMutation, useInvalidate, useNotification } from '@refinedev/core';
import { useState } from 'react';

import { bulkSelection, bulkSummary, offReason, type BulkSelection } from './bulk-selection';

interface RegistrationBulkActionsProps {
  selectedRows: readonly RegistrationListItem[];
  /** Called with the ids not changed (skipped or refused), so they stay selected for a second look. */
  onDone: (failedIds: string[]) => void;
}

/** An action button that says how many selected rows it applies to and, when none, why. */
function BulkActionButton({
  label,
  selection,
  isBusy,
  onClick,
  ...buttonProps
}: {
  label: string;
  selection: BulkSelection;
  isBusy: boolean;
  onClick: () => void;
} & Pick<ButtonProps, 'variant' | 'color'>): React.JSX.Element {
  const count = selection.eligibleIds.length;
  const hint = offReason(selection);
  return (
    <Tooltip title={hint}>
      {/* A disabled button fires no events, so the tooltip hangs on a wrapper. */}
      <span>
        <Button {...buttonProps} disabled={count === 0 || hint !== '' || isBusy} onClick={onClick}>
          {count > 0 ? `${label} (${String(count)})` : label}
        </Button>
      </span>
    </Tooltip>
  );
}

/**
 * Cancel or mark attended for the selected rows. Each button counts the rows the shared staff rules
 * allow and sends only those; the rest are reported as skipped with the reason. The server still
 * checks every row and reports any it refuses.
 */
export function RegistrationBulkActions({
  selectedRows,
  onDone,
}: RegistrationBulkActionsProps): React.JSX.Element {
  const { mutate, mutation } = useCustomMutation<BulkStatusResponse>();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [isConfirmingCancel, setConfirmingCancel] = useState(false);
  const now = new Date();
  const toAttend = bulkSelection(selectedRows, RegistrationStatus.ATTENDED, now);
  const toCancel = bulkSelection(selectedRows, RegistrationStatus.CANCELLED, now);
  // Checked again at the click, so a session that started while the page was open is not sent.
  const run = (status: BulkTargetStatus): void => {
    const selection = bulkSelection(selectedRows, status, new Date());
    if (selection.eligibleIds.length === 0) {
      open?.(bulkSummary({ results: [] }, selection.skipped));
      onDone(selection.skippedIds);
      return;
    }
    mutate(
      {
        url: '/registrations/bulk-status',
        method: 'post',
        values: { ids: selection.eligibleIds, status },
      },
      {
        onSuccess: ({ data }) => {
          open?.(bulkSummary(data, selection.skipped));
          const refusedIds = data.results.filter((result) => !result.ok).map((result) => result.id);
          onDone([...selection.skippedIds, ...refusedIds]);
          // Cancelling frees seats and may promote the waitlist, so session and event numbers change
          // too, on any page showing them: rows may belong to several sessions, hence every cached one.
          void invalidate({ resource: Resource.REGISTRATIONS, invalidates: ['list'] });
          void invalidate({ resource: Resource.SESSIONS, invalidates: ['resourceAll'] });
          void invalidate({ resource: Resource.EVENTS, invalidates: ['resourceAll'] });
        },
      },
    );
  };
  const count = selectedRows.length;
  const cancelCount = toCancel.eligibleIds.length;
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="body2" aria-live="polite">
        {String(count)} selected
      </Typography>
      <BulkActionButton
        label="Mark attended"
        variant="contained"
        selection={toAttend}
        isBusy={mutation.isPending}
        onClick={() => {
          run(RegistrationStatus.ATTENDED);
        }}
      />
      <BulkActionButton
        label="Cancel bookings"
        variant="outlined"
        color="error"
        selection={toCancel}
        isBusy={mutation.isPending}
        onClick={() => {
          setConfirmingCancel(true);
        }}
      />
      <Dialog
        open={isConfirmingCancel}
        onClose={() => {
          setConfirmingCancel(false);
        }}
      >
        <DialogTitle>Cancel {String(cancelCount)} booking(s)?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The customers lose their seats or waitlist places, and freed seats go to the waitlist.
            This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmingCancel(false);
            }}
          >
            Keep bookings
          </Button>
          <Button
            color="error"
            onClick={() => {
              setConfirmingCancel(false);
              run(RegistrationStatus.CANCELLED);
            }}
          >
            Cancel bookings
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
