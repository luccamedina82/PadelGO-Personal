-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "exceptionApprovedAt" TIMESTAMP(3),
ADD COLUMN     "outOfHoursWarning" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Court" ADD COLUMN     "hideFromGrid" BOOLEAN NOT NULL DEFAULT false;
