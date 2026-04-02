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
  baseStart?: number
  baseEnd?: number
  highlightBookingId?: string
  isNavigating?: boolean
}

export default function ReservasShell({
  courts,
  bookings,
  date,
  clubId,
  gridStart,
  gridEnd,
  baseStart,
  baseEnd,
  highlightBookingId,
  isNavigating,
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
        baseStart={baseStart}
        baseEnd={baseEnd}
        highlightBookingId={highlightBookingId}
        isNavigating={isNavigating}
      />
    </div>
  )
}
