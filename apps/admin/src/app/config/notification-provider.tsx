import Button from '@mui/material/Button';
import { useNotificationProvider } from '@refinedev/mui';
import { useSnackbar } from 'notistack';

import { isUndoNotice } from '@/shared/lib/undo-notice';

import type { NotificationProvider } from '@refinedev/core';

const SECOND_MS = 1000;

/**
 * Refine's notifications, except the app's own undo notices: Refine draws undo as an unlabelled
 * icon that screen readers cannot name, so those get a plain "Undo" button. Every other notice,
 * Refine's own undoable saves included, keeps Refine's behaviour.
 */
export function useAppNotificationProvider(): NotificationProvider {
  const refine = useNotificationProvider();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  return {
    ...refine,
    open: (params) => {
      const { type, message, key, cancelMutation, undoableTimeout } = params;
      if (type !== 'progress' || !isUndoNotice(key) || undoableTimeout === undefined) {
        refine.open(params);
        return;
      }
      enqueueSnackbar(message, {
        ...(key === undefined ? {} : { key }),
        preventDuplicate: true,
        autoHideDuration: undoableTimeout * SECOND_MS,
        action: (snackbarKey) => (
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              cancelMutation?.();
              closeSnackbar(snackbarKey);
            }}
          >
            Undo
          </Button>
        ),
      });
    },
  };
}
