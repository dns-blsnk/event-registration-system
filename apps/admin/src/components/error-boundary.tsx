import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Component, type ReactNode } from 'react';

import { requestIdOf } from '../api/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this changes after a crash (the user moved on), the boundary shows its children again. */
  resetKey?: string;
  /** How "Reload page" reloads; a full browser reload unless a test passes its own. */
  reload?: () => void;
}

function reloadBrowser(): void {
  window.location.reload();
}

/** A flag, not the error itself: a thrown `undefined` is still a failure. */
type ErrorBoundaryState = { hasError: false } | { hasError: true; error: unknown };

/**
 * Catches a render crash so one broken page does not blank the whole admin. React needs a class
 * for this. Request failures do not land here (Refine shows them as notifications, server errors
 * with their request id); this screen covers bugs, and shows a request id if the error has one.
 * Nothing is reported from here: the admin has no client-side logging by design.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const requestId = requestIdOf(this.state.error);
    return (
      <Stack spacing={2} alignItems="flex-start" sx={{ m: 4 }} role="alert">
        <Typography variant="h5" component="h1">
          Something went wrong on this page
        </Typography>
        <Typography>Reload the page. If it keeps happening, tell an administrator.</Typography>
        {requestId !== undefined && (
          <Alert severity="info">
            Request id: <strong>{requestId}</strong>
          </Alert>
        )}
        {/* A full reload also drops cached data that may be what made the page fail. */}
        <Button
          variant="contained"
          onClick={() => {
            (this.props.reload ?? reloadBrowser)();
          }}
        >
          Reload page
        </Button>
      </Stack>
    );
  }
}
