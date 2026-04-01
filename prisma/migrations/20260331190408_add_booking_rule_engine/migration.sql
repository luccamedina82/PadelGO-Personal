/*
  Warnings:

  - You are about to drop the column `allowedDurations` on the `Club` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Club" DROP COLUMN "allowedDurations";

-- CreateTable
CREATE TABLE "BookingRule" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "courtId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "price" INTEGER,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "allowedDurations" INTEGER[] DEFAULT ARRAY[60, 90, 120]::INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingRule_clubId_idx" ON "BookingRule"("clubId");

-- CreateIndex
CREATE INDEX "BookingRule_courtId_idx" ON "BookingRule"("courtId");

-- AddForeignKey
ALTER TABLE "BookingRule" ADD CONSTRAINT "BookingRule_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRule" ADD CONSTRAINT "BookingRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;
