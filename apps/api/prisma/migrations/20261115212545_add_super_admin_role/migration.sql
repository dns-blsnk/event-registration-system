-- AlterEnum: before ADMIN, so sorting users by role puts the most powerful first, as in the schema.
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';
