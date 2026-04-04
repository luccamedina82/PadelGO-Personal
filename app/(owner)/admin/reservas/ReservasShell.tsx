'use client'

import BookingGrid from '@/features/reservas/components/booking-grid/BookingGrid'
import type { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { PendingCreate } from '@/features/reservas/components/booking-grid/hooks/useBookingDragCreate'

interface ReservasShellProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  date: string
  clubId?: string
  gridStart: number
  gridEnd: number
  baseStart?: number
  baseEnd?: number
  conflictIds?: ReadonlySet<string>
  show24Hours?: boolean
  onToggle24Hours?: () => void
  hasHiddenBookings?: boolean
  todayConflictCount?: number
  totalConflictCount?: number
  highlightBookingId?: string
  onCellClick?: (courtId: string, slotMinutes: number, cellRect?: DOMRect) => void
  onDragCreateReady?: (pending: PendingCreate, cancel: () => void, created: (bookingId?: string) => void) => void
  isFormOpen?: boolean
  activeDraft?: { courtId: string; startMin: number; durationMinutes: number } | null
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
  conflictIds,
  show24Hours,
  onToggle24Hours,
  hasHiddenBookings,
  todayConflictCount,
  totalConflictCount,
  highlightBookingId,
  onCellClick,
  onDragCreateReady,
  isFormOpen,
  activeDraft,
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
        conflictIds={conflictIds}
        show24Hours={show24Hours}
        onToggle24Hours={onToggle24Hours}
        hasHiddenBookings={hasHiddenBookings}
        todayConflictCount={todayConflictCount}
        totalConflictCount={totalConflictCount}
        highlightBookingId={highlightBookingId}
        onCellClick={onCellClick}
        onDragCreateReady={onDragCreateReady}
        isFormOpen={isFormOpen}
        activeDraft={activeDraft}
      />
    </div>
  )
}
