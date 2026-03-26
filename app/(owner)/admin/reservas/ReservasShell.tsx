'use client'

import BookingGrid from '@/features/reservas/components/booking-grid/BookingGrid'
import type { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface ReservasShellProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  date: string
  clubId?: string
  gridStart: number
  gridEnd: number
  highlightBookingId?: string
}

export default function ReservasShell({
  courts,
  bookings,
  date,
  clubId,
  gridStart,
  gridEnd,
  highlightBookingId,
}: ReservasShellProps) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <BookingGrid
        courts={courts}
        bookings={bookings}
        date={date}
        clubId={clubId}
        gridStart={gridStart}
        gridEnd={gridEnd}
        highlightBookingId={highlightBookingId}
      />
    </div>
  )
}
