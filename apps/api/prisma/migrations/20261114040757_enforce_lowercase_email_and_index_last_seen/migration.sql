-- CreateIndex
CREATE INDEX "auth_sessions_last_seen_at_idx" ON "auth_sessions"("last_seen_at");

-- Emails are stored normalised (trimmed, lower-cased) so the unique index is case-insensitive.
-- Prisma cannot express CHECK constraints in the schema, so this one lives in the migration.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalised_check" CHECK ("email" = lower(btrim("email")));
