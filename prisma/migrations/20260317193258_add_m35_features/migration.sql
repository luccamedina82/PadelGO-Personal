-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paidPlayerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "allowedDurations" INTEGER[] DEFAULT ARRAY[60, 90, 120]::INTEGER[],
ADD COLUMN     "cancellationFeePercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SpecialHours" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarStockEntry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarStockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialHours_clubId_idx" ON "SpecialHours"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialHours_clubId_date_key" ON "SpecialHours"("clubId", "date");

-- CreateIndex
CREATE INDEX "BarStockEntry_clubId_idx" ON "BarStockEntry"("clubId");

-- CreateIndex
CREATE INDEX "BarStockEntry_productId_idx" ON "BarStockEntry"("productId");

-- CreateIndex
CREATE INDEX "BarStockEntry_createdAt_idx" ON "BarStockEntry"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_type_createdAt_idx" ON "NotificationLog"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_bookingId_idx" ON "NotificationLog"("bookingId");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- AddForeignKey
ALTER TABLE "SpecialHours" ADD CONSTRAINT "SpecialHours_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockEntry" ADD CONSTRAINT "BarStockEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockEntry" ADD CONSTRAINT "BarStockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockEntry" ADD CONSTRAINT "BarStockEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
