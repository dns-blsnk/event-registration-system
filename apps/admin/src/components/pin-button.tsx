import { PINNED_EVENTS_PATH, type EventListItem } from '@ers/shared';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useCustomMutation, useInvalidate, useList } from '@refinedev/core';

const PINS_FRESH_MS = 30_000;

/** The signed-in staff member's pinned events; one cached request shared by every pin button. */
export function usePinnedEvents(): {
  events: EventListItem[];
  isLoading: boolean;
  isFailed: boolean;
} {
  const { result, query } = useList<EventListItem>({
    resource: PINNED_EVENTS_PATH,
    pagination: { mode: 'off' },
    errorNotification: false,
    // Every pin button reads this list; a short freshness keeps them from refetching on mount.
    // Pinning and unpinning invalidate it, so it never shows a stale pin of this user's own.
    queryOptions: { staleTime: PINS_FRESH_MS },
  });
  return { events: result.data, isLoading: query.isLoading, isFailed: query.isError };
}

/** What the button does now, or why it cannot. */
function pinHint(isPinned: boolean, isFailed: boolean): string {
  if (isFailed) return 'Pins could not be loaded';
  return isPinned ? 'Unpin from dashboard' : 'Pin to dashboard';
}

/** Pins an event to the dashboard, or unpins it; the dashboard and every button follow. */
export function PinButton({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}): React.JSX.Element {
  const { events, isLoading, isFailed } = usePinnedEvents();
  const { mutate, mutation } = useCustomMutation();
  const invalidate = useInvalidate();
  const isPinned = events.some((event) => event.id === eventId);
  const label = isPinned ? `Unpin ${title} from the dashboard` : `Pin ${title} to the dashboard`;
  // Unknown state (loading, or the pins failed to load): a click could do the opposite of intended.
  const isUnknown = isLoading || isFailed;
  const hint = pinHint(isPinned, isFailed);
  return (
    <Tooltip title={hint}>
      {/* A disabled button fires no events, so the tooltip hangs on a wrapper. */}
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={isPinned}
          color={isPinned ? 'primary' : 'default'}
          disabled={mutation.isPending || isUnknown}
          onClick={() => {
            mutate(
              {
                url: `/${PINNED_EVENTS_PATH}/${eventId}`,
                method: isPinned ? 'delete' : 'put',
                values: {},
                successNotification: false,
              },
              {
                onSuccess: () => {
                  void invalidate({ resource: PINNED_EVENTS_PATH, invalidates: ['list'] });
                },
              },
            );
          }}
        >
          {isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
