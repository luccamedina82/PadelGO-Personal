'use client'

import BookingGrid from '@/features/reservas/components/booking-grid/BookingGrid'
import WeeklyBookingGrid from '@/features/reservas/components/weekly-booking-grid/WeeklyBookingGrid'
import type { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface ReservasShellProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  weeklyBookings?: BookingBlock[]
  date: string
  weekStart?: string
  clubId?: string
  gridStart: number
  gridEnd: number
  highlightBookingId?: string
  viewMode?: 'day' | 'week'
}

export default function ReservasShell({
  courts,
  bookings,
  date,
  weekStart,
  clubId,
  gridStart,
  gridEnd,
  highlightBookingId,
  viewMode = 'day',
}: ReservasShellProps) {
  if (viewMode === 'week' && bookings && weekStart) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <WeeklyBookingGrid
          courts={courts}
          bookings={bookings}
          weekStart={weekStart}
          gridStart={gridStart}
          gridEnd={gridEnd}
        />
      </div>
    )
  }

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
