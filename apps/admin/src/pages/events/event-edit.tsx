import { EVENT_TRANSITIONS, type EventDetail, type EventStatus } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';

import { EventBannerUpload } from './event-banner-upload';
import { EventFormFields } from './event-form-fields';
import {
  EMPTY_EVENT_FORM,
  toEventFormValues,
  toEventPatch,
  type EventFormValues,
} from './event-form-values';
import { submitEventPayload } from './use-event-submit';

import type { HttpError } from '@refinedev/core';

/** The loaded event as the form keeps it: form values plus what the page needs around the form. */
type EditedEvent = EventFormValues & { id: string; bannerUrl: string | null; status: EventStatus };

/** Completed and cancelled events are final: no status leads anywhere from them, and nothing changes. */
function isFinal(status: EventStatus): boolean {
  return EVENT_TRANSITIONS[status].length === 0;
}

/** Edit an event's details, dates and tags; the banner is saved on its own, right away. */
export function EventEdit(): React.JSX.Element {
  const {
    saveButtonProps,
    refineCore: { onFinish, query },
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = useForm<EventDetail, HttpError, EventFormValues, object, EditedEvent>({
    defaultValues: EMPTY_EVENT_FORM,
    refineCoreProps: {
      redirect: 'show',
      // The API returns ISO dates and tag objects; the form edits local dates and the tag list.
      queryOptions: {
        select: ({ data }) => ({
          data: {
            ...toEventFormValues(data),
            id: data.id,
            bannerUrl: data.bannerUrl,
            status: data.status,
          },
        }),
      },
    },
  });
  const event = query?.data?.data;
  const isLocked = event !== undefined && isFinal(event.status);
  const save = handleSubmit(async (values) => {
    await submitEventPayload(
      onFinish,
      event === undefined ? toEventPatch(values, EMPTY_EVENT_FORM) : toEventPatch(values, event),
    );
  });
  return (
    <Edit
      saveButtonProps={{
        ...saveButtonProps,
        disabled: isLocked || saveButtonProps.disabled,
        onClick: (submit) => void save(submit),
      }}
    >
      <Stack spacing={3}>
        {isLocked && (
          <Alert severity="info">Completed and cancelled events can no longer be changed.</Alert>
        )}
        <EventFormFields register={register} control={control} errors={errors} />
        {event !== undefined && !isLocked && (
          <Box>
            <EventBannerUpload eventId={event.id} hasBanner={event.bannerUrl !== null} />
          </Box>
        )}
      </Stack>
    </Edit>
  );
}
