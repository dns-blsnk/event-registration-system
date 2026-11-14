import { isRole, type AppLogDetail, type AppLogListItem } from '@ers/shared';

import type { AppLog } from '../../generated/prisma/client.js';

export function toAppLogListItem(row: AppLog): AppLogListItem {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    level: row.level,
    category: row.category,
    requestId: row.requestId,
    method: row.method,
    route: row.route,
    statusCode: row.statusCode,
    errorCode: row.errorCode,
    message: row.message,
    userId: row.userId,
    // Stored as a snapshot string; anything that is no longer a role reads as unknown.
    userRole: isRole(row.userRole) ? row.userRole : null,
    durationMs: row.durationMs,
  };
}

export function toAppLogDetail(row: AppLog): AppLogDetail {
  return {
    ...toAppLogListItem(row),
    stack: row.stack,
    ip: row.ip,
    userAgent: row.userAgent,
    context: row.context,
  };
}
