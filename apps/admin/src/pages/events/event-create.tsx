import { Create } from '@refinedev/mui';
import { useForm } from '@refinedev/react-hook-form';

import { EventFormFields } from './event-form-fields';
import { EMPTY_EVENT_FORM, toEventPayload, type EventFormValues } from './event-form-values';
import { submitEventPayload } from './use-event-submit';

import type { EventDetail } from '@ers/shared';
import type { HttpError } from '@refinedev/core';

/** A new event always starts as a draft owned by the creator; it opens on its page afterwards. */
export function EventCreate(): React.JSX.Element {
  const {
    saveButtonProps,
    refineCore: { onFinish },
    handleSubmit,
    register,
    control,
    formState: { errors },
  } = useForm<EventDetail, HttpError, EventFormValues>({
    defaultValues: EMPTY_EVENT_FORM,
    refineCoreProps: { redirect: 'show' },
  });
  const save = handleSubmit(async (values) => {
    await submitEventPayload(onFinish, toEventPayload(values));
  });
  return (
    <Create saveButtonProps={{ ...saveButtonProps, onClick: (event) => void save(event) }}>
      <EventFormFields register={register} control={control} errors={errors} />
    </Create>
  );
}
