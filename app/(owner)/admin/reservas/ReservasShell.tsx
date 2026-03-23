'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import BookingGrid from '@/components/booking/BookingGrid'
import WeeklyBookingGrid from '@/components/booking/WeeklyBookingGrid'
import type { BookingBlock, CourtColumn } from '@/components/booking/BookingGrid'
import type { WeeklyBookingBlock } from '@/components/booking/WeeklyBookingGrid'

interface ReservasShellProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  weeklyBookings?: BookingBlock[]
  date: string
  weekStart?: string
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
  gridStart,
  gridEnd,
  highlightBookingId,
  viewMode = 'day',
}: ReservasShellProps) {
  const router = useRouter()
  const [isRefreshing] = useTransition()

  function handleWeekBlockClick(booking: WeeklyBookingBlock) {
    // Navigate to day view for that booking's date
    router.push(`/admin/reservas?date=${booking.date}&view=day`)
  }

  if (viewMode === 'week' && bookings && weekStart) {
    return (
      <div className="relative h-full min-h-0">
        {isRefreshing && (
          <div className="absolute inset-0 z-30 bg-bg/45 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-xs text-muted font-medium">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Actualizando reservas...
            </div>
          </div>
        )}
        <div className="h-full min-h-0 flex flex-col">
          <WeeklyBookingGrid
            courts={courts}
            bookings={bookings}
            weekStart={weekStart}
            gridStart={gridStart}
            gridEnd={gridEnd}
            onBlockClick={handleWeekBlockClick}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-0">
      {isRefreshing && (
        <div className="absolute inset-0 z-30 bg-bg/45 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-xs text-muted font-medium">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Actualizando reservas...
          </div>
        </div>
      )}
      <div className="h-full min-h-0 flex flex-col">
        <BookingGrid
          courts={courts}
          bookings={bookings}
          date={date}
          gridStart={gridStart}
          gridEnd={gridEnd}
          highlightBookingId={highlightBookingId}
        />
      </div>
    </div>
  )
}
