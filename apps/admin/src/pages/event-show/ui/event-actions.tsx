import {
  Action,
  EVENT_TRANSITIONS,
  eventTimingProblem,
  EventStatus,
  Resource,
  type EventDetail,
} from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useCan, useCustomMutation, useInvalidate } from '@refinedev/core';
import { useState } from 'react';

type LifecycleAction = typeof Action.PUBLISH | typeof Action.COMPLETE | typeof Action.CANCEL;

const TARGET_STATUS: Readonly<Record<LifecycleAction, EventStatus>> = {
  [Action.PUBLISH]: EventStatus.PUBLISHED,
  [Action.COMPLETE]: EventStatus.COMPLETED,
  [Action.CANCEL]: EventStatus.CANCELLED,
};

const LABELS: Readonly<Record<LifecycleAction, string>> = {
  [Action.PUBLISH]: 'Publish',
  [Action.COMPLETE]: 'Complete',
  [Action.CANCEL]: 'Cancel event',
};

const DONE: Readonly<Record<LifecycleAction, string>> = {
  [Action.PUBLISH]: 'The event is published and open for bookings',
  [Action.COMPLETE]: 'The event is completed',
  [Action.CANCEL]: 'The event is cancelled',
};

/**
 * Whether the action can succeed right now: the transition exists, the timing rules allow it and
 * a draft has sessions to publish. The same shared rules the API enforces; the API still decides.
 */
function isPossible(event: EventDetail, action: LifecycleAction, now: Date): boolean {
  const target = TARGET_STATUS[action];
  if (!EVENT_TRANSITIONS[event.status].includes(target)) {
    return false;
  }
  if (action === Action.PUBLISH && event.sessionsCount === 0) {
    return false;
  }
  return (
    eventTimingProblem(target, {
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      now,
    }) === undefined
  );
}

interface ActionButtonProps {
  event: EventDetail;
  action: LifecycleAction;
  isBusy: boolean;
  onRun: (action: LifecycleAction) => void;
}

function ActionButton({
  event,
  action,
  isBusy,
  onRun,
}: ActionButtonProps): React.JSX.Element | null {
  const { data: access } = useCan({ resource: Resource.EVENTS, action });
  const [confirming, setConfirming] = useState(false);
  if (access?.can !== true || !isPossible(event, action, new Date())) {
    return null;
  }
  const isCancel = action === Action.CANCEL;
  return (
    <>
      <Button
        variant={isCancel ? 'outlined' : 'contained'}
        color={isCancel ? 'error' : 'primary'}
        disabled={isBusy}
        onClick={() => {
          if (isCancel) {
            setConfirming(true);
          } else {
            onRun(action);
          }
        }}
      >
        {LABELS[action]}
      </Button>
      {isCancel && (
        <Dialog
          open={confirming}
          onClose={() => {
            setConfirming(false);
          }}
        >
          <DialogTitle>Cancel this event?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Confirmed and waitlisted bookings are cancelled and those customers lose their places.
              Attendance already recorded stays. This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep event
            </Button>
            <Button
              color="error"
              onClick={() => {
                setConfirming(false);
                onRun(action);
              }}
            >
              Cancel event
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

/** Publish, complete and cancel, as far as the event's status, its dates and the user's role allow. */
export function EventActions({ event }: { event: EventDetail }): React.JSX.Element {
  // One mutation for all three, so a second action cannot start while the first is running.
  const { mutate, mutation } = useCustomMutation();
  const invalidate = useInvalidate();
  const run = (action: LifecycleAction): void => {
    mutate(
      {
        url: `/events/${event.id}/${action}`,
        method: 'post',
        values: {},
        successNotification: { type: 'success', message: DONE[action] },
      },
      {
        onSuccess: () => {
          void invalidate({
            resource: Resource.EVENTS,
            id: event.id,
            invalidates: ['detail', 'list'],
          });
          // Cancelling frees seats and empties waitlists, so the sessions table changes too.
          void invalidate({ resource: Resource.SESSIONS, invalidates: ['list'] });
        },
      },
    );
  };
  return (
    <>
      {([Action.PUBLISH, Action.COMPLETE, Action.CANCEL] as const).map((action) => (
        <ActionButton
          key={action}
          event={event}
          action={action}
          isBusy={mutation.isPending}
          onRun={run}
        />
      ))}
    </>
  );
}
