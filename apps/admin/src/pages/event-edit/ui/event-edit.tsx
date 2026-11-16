import { EventStatus, isEventLocked, Resource, type EventDetail } from '@ers/shared';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useNavigation } from '@refinedev/core';
import { Edit } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';

import {
  EMPTY_EVENT_FORM,
  EventBannerField,
  EventFormFields,
  toEventFormValues,
  toEventPatch,
  useEventBanner,
  type EventFormValues,
} from '@/features/event-form';
import { errorShownByRefine } from '@/shared/lib/forms';

import type { HttpError } from '@refinedev/core';

/** The loaded event as the form keeps it: form values plus what the page needs around the form. */
type EditedEvent = EventFormValues & {
  id: string;
  bannerUrl: string | null;
  status: EventStatus;
};

/**
 * Edit an event's banner, details, dates and tags. One Save sends the details, then the banner
 * change. Only a draft may be left without a banner: the API refuses to publish one.
 */
export function EventEdit(): React.JSX.Element {
  const { show } = useNavigation();
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
      redirect: false,
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
  const isLocked = event !== undefined && isEventLocked(event.status);
  const banner = useEventBanner({
    hasBanner: event !== undefined && event.bannerUrl !== null,
    isRequired: event !== undefined && event.status !== EventStatus.DRAFT,
  });
  // Covers the banner upload too, which runs after Refine's own save state has ended.
  const [isSaving, setSaving] = useState(false);
  const title = useWatch({ control, name: 'title' });
  const update = async (values: EventFormValues, isBannerReady: boolean): Promise<void> => {
    if (event === undefined || !isBannerReady) return;
    setSaving(true);
    try {
      const result = await onFinish(toEventPatch(values, event) as never).catch(errorShownByRefine);
      if (result !== undefined && (await banner.save(event.id))) show(Resource.EVENTS, event.id);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Edit
      saveButtonProps={{
        ...saveButtonProps,
        disabled: isLocked || isSaving || saveButtonProps.disabled,
        onClick: (submit) => {
          // Checked together with the fields, so every problem shows at once.
          const isBannerReady = banner.validate();
          void handleSubmit((values) => update(values, isBannerReady))(submit);
        },
      }}
    >
      <Stack spacing={3}>
        {isLocked && (
          <Alert severity="info">Completed and cancelled events can no longer be changed.</Alert>
        )}
        {event !== undefined && (
          <EventBannerField
            banner={banner}
            title={title}
            currentUrl={event.bannerUrl}
            disabled={isLocked}
          />
        )}
        <EventFormFields register={register} control={control} errors={errors} />
      </Stack>
    </Edit>
  );
}
