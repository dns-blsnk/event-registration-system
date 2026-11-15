import {
  APP_LOG_CATEGORY_LABELS,
  APP_LOG_FIELDS,
  APP_LOG_LEVEL_LABELS,
  ROLE_LABELS,
  type AppLogDetail,
} from '@ers/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useShow } from '@refinedev/core';
import { Show } from '@refinedev/mui';

import { formatDateTime } from '@/shared/lib/format';
import { LabelledValue } from '@/shared/ui/labelled-value';

const NOT_RECORDED = '—';
const JSON_INDENT = 2;

/** Preformatted, scrollable text for stacks and context; React escapes it like any other text. */
function Preformatted({ text }: { text: string }): React.JSX.Element {
  return (
    <Box
      component="pre"
      sx={{ m: 0, p: 1, overflowX: 'auto', bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}
    >
      {text}
    </Box>
  );
}

function orNotRecorded(value: string | number | null): string {
  return value === null ? NOT_RECORDED : String(value);
}

function userOf(entry: AppLogDetail): string {
  if (entry.userId === null) return NOT_RECORDED;
  return entry.userRole === null
    ? entry.userId
    : `${entry.userId} (${ROLE_LABELS[entry.userRole]})`;
}

/** One journal entry with everything recorded for it. */
export function AppLogShow(): React.JSX.Element {
  const { query } = useShow<AppLogDetail>();
  const entry = query.data?.data;
  return (
    <Show isLoading={query.isLoading} title="Log entry" canEdit={false} canDelete={false}>
      {query.isError && entry === undefined && (
        <Alert severity="error">This entry could not be loaded.</Alert>
      )}
      {entry !== undefined && (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} useFlexGap flexWrap="wrap">
            <LabelledValue label={APP_LOG_FIELDS.createdAt.label}>
              {formatDateTime(entry.createdAt)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.level.label}>
              {APP_LOG_LEVEL_LABELS[entry.level]}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.category.label}>
              {APP_LOG_CATEGORY_LABELS[entry.category]}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.statusCode.label}>
              {orNotRecorded(entry.statusCode)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.errorCode.label}>
              {orNotRecorded(entry.errorCode)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.durationMs.label}>
              {entry.durationMs === null ? NOT_RECORDED : `${String(entry.durationMs)} ms`}
            </LabelledValue>
          </Stack>
          <LabelledValue label={APP_LOG_FIELDS.message.label}>{entry.message}</LabelledValue>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} useFlexGap flexWrap="wrap">
            <LabelledValue label={APP_LOG_FIELDS.requestId.label}>
              {orNotRecorded(entry.requestId)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.method.label}>
              {orNotRecorded(entry.method)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.route.label}>
              {orNotRecorded(entry.route)}
            </LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.user.label}>{userOf(entry)}</LabelledValue>
            <LabelledValue label={APP_LOG_FIELDS.ip.label}>{orNotRecorded(entry.ip)}</LabelledValue>
          </Stack>
          <LabelledValue label={APP_LOG_FIELDS.userAgent.label}>
            {orNotRecorded(entry.userAgent)}
          </LabelledValue>
          {entry.stack !== null && (
            <LabelledValue label={APP_LOG_FIELDS.stack.label}>
              <Preformatted text={entry.stack} />
            </LabelledValue>
          )}
          {entry.context !== null && (
            <LabelledValue label={APP_LOG_FIELDS.context.label}>
              <Preformatted text={JSON.stringify(entry.context, null, JSON_INDENT)} />
            </LabelledValue>
          )}
        </Stack>
      )}
    </Show>
  );
}
