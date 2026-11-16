import { Resource } from '@ers/shared';
import Stack from '@mui/material/Stack';
import { useNavigation } from '@refinedev/core';
import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';

import {
  EMPTY_EVENT_FORM,
  EventBannerField,
  EventFormFields,
  toEventPayload,
  useEventBanner,
  type EventFormValues,
} from '@/features/event-form';
import { errorShownByRefine } from '@/shared/lib/forms';

import type { EventDetail } from '@ers/shared';
import type { HttpError } from '@refinedev/core';

/**
 * A new event always starts as a draft owned by the creator, and always with a banner. The event
 * is saved first (the banner needs its id), then the banner; it opens on its page afterwards. If
 * only the banner fails, the saved draft opens for editing so nothing typed is lost.
 */
export function EventCreate(): React.JSX.Element {
  const banner = useEventBanner({ hasBanner: false, isRequired: true });
  const { show, edit } = useNavigation();
  const {
    saveButtonProps,
    refineCore: { onFinish },
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = useForm<EventDetail, HttpError, EventFormValues>({
    defaultValues: EMPTY_EVENT_FORM,
    refineCoreProps: { redirect: false },
  });
  // Covers the banner upload too, which runs after Refine's own save state has ended.
  const [isSaving, setSaving] = useState(false);
  const title = useWatch({ control, name: 'title' });
  const create = async (values: EventFormValues, isBannerReady: boolean): Promise<void> => {
    if (!isBannerReady) return;
    setSaving(true);
    try {
      const result = await onFinish(toEventPayload(values) as never).catch(errorShownByRefine);
      const eventId = result?.data.id;
      if (eventId === undefined) return;
      if (await banner.save(eventId)) show(Resource.EVENTS, eventId);
      else edit(Resource.EVENTS, eventId);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Create
      saveButtonProps={{
        ...saveButtonProps,
        disabled: isSaving || saveButtonProps.disabled,
        onClick: (event) => {
          // Checked together with the fields, so every problem shows at once.
          const isBannerReady = banner.validate();
          void handleSubmit((values) => create(values, isBannerReady))(event);
        },
      }}
    >
      <Stack spacing={3}>
        <EventBannerField banner={banner} title={title} currentUrl={null} />
        <EventFormFields register={register} control={control} errors={errors} />
      </Stack>
    </Create>
  );
}
