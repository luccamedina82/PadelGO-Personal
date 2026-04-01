-- Add courtIds array column (empty = applies to all courts)
ALTER TABLE "BookingRule" ADD COLUMN "courtIds" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing per-court rules: wrap courtId in an array
UPDATE "BookingRule" SET "courtIds" = ARRAY["courtId"] WHERE "courtId" IS NOT NULL;

-- Drop FK constraint and old column
ALTER TABLE "BookingRule" DROP CONSTRAINT IF EXISTS "BookingRule_courtId_fkey";
DROP INDEX IF EXISTS "BookingRule_courtId_idx";
ALTER TABLE "BookingRule" DROP COLUMN "courtId";
