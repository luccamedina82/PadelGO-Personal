-- Migration: simplify_booking_source_add_maintenance

-- 1. Add isUnderMaintenance to Court
ALTER TABLE "Court" ADD COLUMN IF NOT EXISTS "isUnderMaintenance" BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop the column default before changing the type
ALTER TABLE "Booking" ALTER COLUMN "source" DROP DEFAULT;

-- 3. Rename old enum so we can create the new one
ALTER TYPE "BookingSource" RENAME TO "BookingSource_old";

-- 4. Create new simplified enum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'MANUAL_STAFF', 'MANUAL_SUPPORT', 'BLOCK');

-- 5. Migrate Booking.source data: map old values → new, cast column
ALTER TABLE "Booking"
  ALTER COLUMN "source" TYPE "BookingSource"
  USING (
    CASE "source"::text
      WHEN 'MANUAL_OWNER'   THEN 'MANUAL_STAFF'
      WHEN 'ENTRENAMIENTO'  THEN 'BLOCK'
      WHEN 'TORNEO'         THEN 'BLOCK'
      WHEN 'EVENTO'         THEN 'BLOCK'
      WHEN 'MANTENIMIENTO'  THEN 'BLOCK'
      ELSE "source"::text
    END
  )::"BookingSource";

-- 6. Restore column default with the new type
ALTER TABLE "Booking" ALTER COLUMN "source" SET DEFAULT 'ONLINE'::"BookingSource";

-- 7. Drop old enum type
DROP TYPE "BookingSource_old";
