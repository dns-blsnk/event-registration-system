-- A database that already has users gets one super admin, so someone can still manage admins:
-- the longest-standing admin. A separate migration, as Postgres cannot use a new enum value in the
-- transaction that added it. Does nothing where a super admin exists or there is no admin (an
-- empty database, which the seed fills with its own super admin).
UPDATE "users"
SET "role" = 'SUPER_ADMIN'
WHERE "id" = (
  SELECT "id" FROM "users" WHERE "role" = 'ADMIN' ORDER BY "created_at", "id" LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'SUPER_ADMIN');
