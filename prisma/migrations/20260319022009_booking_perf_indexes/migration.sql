-- CreateIndex
CREATE INDEX "Booking_clubId_date_idx" ON "Booking"("clubId", "date");

-- CreateIndex
CREATE INDEX "Booking_clubId_date_status_idx" ON "Booking"("clubId", "date", "status");
