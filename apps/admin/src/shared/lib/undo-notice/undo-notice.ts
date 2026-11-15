const UNDO_NOTICE_PREFIX = 'undo:';

/**
 * The key of a notice that offers to undo something just done. The app shows such notices with a
 * labelled "Undo" button; any other "progress" notice keeps Refine's own look.
 */
export function undoNoticeKey(id: string): string {
  return `${UNDO_NOTICE_PREFIX}${id}`;
}

export function isUndoNotice(key: string | undefined): boolean {
  return key?.startsWith(UNDO_NOTICE_PREFIX) === true;
}
