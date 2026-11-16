/** Emails are compared case-insensitively: stored and looked up trimmed and lower-cased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
