import {
  BULK_STATUS_MAX_IDS,
  RegistrationStatus,
  Resource,
  type BulkStatusResponse,
  type BulkTargetStatus,
} from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustomMutation, useInvalidate, useNotification } from '@refinedev/core';
import { useState } from 'react';

interface RegistrationBulkActionsProps {
  selectedIds: string[];
  /** Called with the ids that could not be changed, so they stay selected for a second look. */
  onDone: (failedIds: string[]) => void;
}

/** The outcome: how many changed, and every distinct reason rows were refused, with counts. */
export function bulkSummary(response: BulkStatusResponse): {
  type: 'success' | 'error';
  message: string;
} {
  const failed = response.results.filter((result) => !result.ok);
  const changed = response.results.length - failed.length;
  const updated = `${String(changed)} registration(s) updated`;
  if (failed.length === 0) {
    return { type: 'success', message: updated };
  }
  const reasons = new Map<string, number>();
  for (const result of failed) {
    reasons.set(result.message, (reasons.get(result.message) ?? 0) + 1);
  }
  const refused = [...reasons]
    .map(([message, count]) => `${String(count)} × ${message}`)
    .join('; ');
  return { type: 'error', message: `${updated}. Not changed: ${refused}` };
}

/**
 * Cancel or mark attended for the selected rows. Each row succeeds or fails on its own on the
 * server (wrong status, event not started), and the outcome is reported row by row.
 */
export function RegistrationBulkActions({
  selectedIds,
  onDone,
}: RegistrationBulkActionsProps): React.JSX.Element {
  const { mutate, mutation } = useCustomMutation<BulkStatusResponse>();
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const [isConfirmingCancel, setConfirmingCancel] = useState(false);
  const count = selectedIds.length;
  const run = (status: BulkTargetStatus): void => {
    mutate(
      { url: '/registrations/bulk-status', method: 'post', values: { ids: selectedIds, status } },
      {
        onSuccess: ({ data }) => {
          open?.(bulkSummary(data));
          onDone(data.results.filter((result) => !result.ok).map((result) => result.id));
          // Cancelling frees seats and may promote the waitlist, so session and event numbers change
          // too, on any page showing them: rows may belong to several sessions, hence every cached one.
          void invalidate({ resource: Resource.REGISTRATIONS, invalidates: ['list'] });
          void invalidate({ resource: Resource.SESSIONS, invalidates: ['resourceAll'] });
          void invalidate({ resource: Resource.EVENTS, invalidates: ['resourceAll'] });
        },
      },
    );
  };
  // One request carries at most BULK_STATUS_MAX_IDS rows; the API refuses larger ones.
  const isTooMany = count > BULK_STATUS_MAX_IDS;
  const isDisabled = count === 0 || isTooMany || mutation.isPending;
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="body2" aria-live="polite">
        {String(count)} selected
        {isTooMany && ` (at most ${String(BULK_STATUS_MAX_IDS)} at a time)`}
      </Typography>
      <Button
        variant="contained"
        disabled={isDisabled}
        onClick={() => {
          run(RegistrationStatus.ATTENDED);
        }}
      >
        Mark attended
      </Button>
      <Button
        variant="outlined"
        color="error"
        disabled={isDisabled}
        onClick={() => {
          setConfirmingCancel(true);
        }}
      >
        Cancel bookings
      </Button>
      <Dialog
        open={isConfirmingCancel}
        onClose={() => {
          setConfirmingCancel(false);
        }}
      >
        <DialogTitle>Cancel {String(count)} booking(s)?</DialogTitle>
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
