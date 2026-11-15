import { CATALOG_FIELDS, type CatalogEventDetail } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useShow } from '@refinedev/core';
import { Show } from '@refinedev/mui';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { EventDescription, EventFacts, EventHero } from '@/entities/event';
import { catalogSessionAnchor } from '@/entities/session';

import { CatalogSessionCard } from './catalog-session-card';

/** One published event for a customer: details, then each session with its booking button. */
export function CatalogShow(): React.JSX.Element {
  // The page explains a missing event itself; no second message as a toast.
  const { query } = useShow<CatalogEventDetail>({ errorNotification: false });
  const event = query.data?.data;
  const { hash } = useLocation();
  const isLoaded = event !== undefined;
  // A link to one session (from "My registrations") opens the page scrolled to it, once it is drawn.
  useEffect(() => {
    if (isLoaded && hash !== '') {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
    }
  }, [isLoaded, hash]);
  return (
    <Show
      isLoading={query.isLoading}
      title="Event"
      canEdit={false}
      canDelete={false}
      // Refine's list and refresh buttons are admin tools; the breadcrumb and Back already lead back.
      headerButtons={() => null}
    >
      {query.isError && event === undefined && (
        <Alert severity="error">This event is not available.</Alert>
      )}
      {event !== undefined && (
        <Stack spacing={3}>
          <EventHero title={event.title} bannerUrl={event.bannerUrl} />
          <EventFacts
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            city={event.city}
            venue={event.venue}
            organizerName={event.organizerName}
          />
          <EventDescription label={CATALOG_FIELDS.description.label} text={event.description} />
          <Typography variant="h6" component="h3">
            Sessions
          </Typography>
          {event.sessions.length === 0 && (
            <Typography>No sessions have been announced yet.</Typography>
          )}
          {event.sessions.map((session) => (
            <CatalogSessionCard
              key={session.id}
              session={session}
              eventId={event.id}
              eventTitle={event.title}
              isTargeted={hash === `#${catalogSessionAnchor(session.id)}`}
            />
          ))}
        </Stack>
      )}
    </Show>
  );
}
