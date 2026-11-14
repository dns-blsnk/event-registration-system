import {
  normalizeLabel,
  Resource,
  TAG_FIELDS,
  TAG_NAME_MAX_LENGTH,
  type TagListItem,
} from '@ers/shared';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useForm } from '@refinedev/react-hook-form';

import { errorShownByRefine, fieldHelp, REQUIRED_TEXT } from '../../components/forms';

import type { HttpError } from '@refinedev/core';

interface TagFormValues {
  name: string;
}

interface TagFormDialogProps {
  /** The tag to rename; undefined to create one. */
  tag: TagListItem | undefined;
  /** After a successful save, before closing: lets the page refresh what shows tag names. */
  onSaved: () => void;
  onClose: () => void;
}

/** Create or rename a tag. Names are unique regardless of case; the API reports a clash on the field. */
export function TagFormDialog({ tag, onSaved, onClose }: TagFormDialogProps): React.JSX.Element {
  const original = tag?.name ?? '';
  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<TagListItem, HttpError, TagFormValues>({
    defaultValues: { name: original },
    refineCoreProps: {
      resource: Resource.TAGS,
      action: tag === undefined ? 'create' : 'edit',
      ...(tag === undefined ? {} : { id: tag.id }),
      queryOptions: { enabled: false },
      redirect: false,
      onMutationSuccess: () => {
        onSaved();
        onClose();
      },
    },
    warnWhenUnsavedChanges: false,
  });
  const save = handleSubmit(async ({ name }) => {
    // Compared the way the API stores names, so a rename that changes nothing sends nothing.
    const normalized = normalizeLabel(name);
    if (normalized === original) {
      onClose();
      return;
    }
    await onFinish({ name: normalized }).catch(errorShownByRefine);
  });
  const title = tag === undefined ? 'Add tag' : 'Rename tag';
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="tag-form-title">
      <form noValidate onSubmit={(event) => void save(event)}>
        <DialogTitle id="tag-form-title">{title}</DialogTitle>
        <DialogContent>
          <TextField
            {...register('name', REQUIRED_TEXT)}
            label={TAG_FIELDS.name.label}
            helperText={fieldHelp(errors.name, TAG_FIELDS.name.help)}
            error={errors.name !== undefined}
            slotProps={{ htmlInput: { maxLength: TAG_NAME_MAX_LENGTH } }}
            required
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={formLoading}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
