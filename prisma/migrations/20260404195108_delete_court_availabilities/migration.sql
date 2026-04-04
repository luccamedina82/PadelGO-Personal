/*
  Warnings:

  - You are about to drop the `CourtAvailability` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourtAvailability" DROP CONSTRAINT "CourtAvailability_courtId_fkey";

-- DropTable
DROP TABLE "CourtAvailability";
