'use client'

import { useRouter } from 'next/navigation'
import BookingGrid from '@/components/booking/BookingGrid'
import WeeklyBookingGrid from '@/components/booking/WeeklyBookingGrid'
import type { BookingBlock, CourtColumn, UpdateBookingData } from '@/components/booking/BookingGrid'
import type { WeeklyBookingBlock } from '@/components/booking/WeeklyBookingGrid'
import type { ActionResult } from '@/types'

interface ReservasShellProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  weeklyBookings?: WeeklyBookingBlock[]
  date: string
  weekStart?: string
  gridStart: number
  gridEnd: number
  cancelBookingAction: (bookingId: string) => Promise<ActionResult>
  confirmBookingAction: (bookingId: string) => Promise<ActionResult>
  updatePaymentStatusAction?: (
    bookingId: string,
    status: 'PAID' | 'UNPAID' | 'MANUAL'
  ) => Promise<ActionResult>
  updateBookingAction?: (bookingId: string, data: UpdateBookingData) => Promise<ActionResult>
  updatePlayersAction?: (
    bookingId: string,
    playerIds: string[],
    paidPlayerIds: string[]
  ) => Promise<ActionResult>
  searchPlayersAction?: (
    query: string
  ) => Promise<ActionResult<{ id: string; name: string; email: string }[]>>
  highlightBookingId?: string
  viewMode?: 'day' | 'week'
}

export default function ReservasShell({
  courts,
  bookings,
  weeklyBookings,
  date,
  weekStart,
  gridStart,
  gridEnd,
  cancelBookingAction,
  confirmBookingAction,
  updatePaymentStatusAction,
  updateBookingAction,
  updatePlayersAction,
  searchPlayersAction,
  highlightBookingId,
  viewMode = 'day',
}: ReservasShellProps) {
  const router = useRouter()

  async function handleCancel(bookingId: string) {
    const result = await cancelBookingAction(bookingId)
    if (result.success) router.refresh()
    else throw new Error(result.error ?? 'Error')
  }

  async function handleConfirm(bookingId: string) {
    const result = await confirmBookingAction(bookingId)
    if (result.success) router.refresh()
    else throw new Error(result.error ?? 'Error')
  }

  async function handleUpdatePayment(bookingId: string, status: 'PAID' | 'UNPAID' | 'MANUAL') {
    if (!updatePaymentStatusAction) return
    const result = await updatePaymentStatusAction(bookingId, status)
    if (result.success) router.refresh()
    else throw new Error(result.error ?? 'Error')
  }

  async function handleUpdateBooking(bookingId: string, data: UpdateBookingData) {
    if (!updateBookingAction) return
    const result = await updateBookingAction(bookingId, data)
    if (result.success) router.refresh()
    else throw new Error(result.error ?? 'Error')
  }

  async function handleUpdatePlayers(
    bookingId: string,
    playerIds: string[],
    paidPlayerIds: string[]
  ) {
    if (!updatePlayersAction) return
    const result = await updatePlayersAction(bookingId, playerIds, paidPlayerIds)
    if (result.success) router.refresh()
    else throw new Error(result.error ?? 'Error')
  }

  async function handleSearchPlayers(query: string): Promise<{ id: string; name: string }[]> {
    if (!searchPlayersAction) return []
    const result = await searchPlayersAction(query)
    if (result.success && result.data) return result.data
    return []
  }

  function handleWeekBlockClick(booking: WeeklyBookingBlock) {
    // Navigate to day view for that booking's date
    router.push(`/admin/reservas?date=${booking.date}&view=day`)
  }

  if (viewMode === 'week' && weeklyBookings && weekStart) {
    return (
      <WeeklyBookingGrid
        courts={courts}
        bookings={weeklyBookings}
        weekStart={weekStart}
        gridStart={gridStart}
        gridEnd={gridEnd}
        onBlockClick={handleWeekBlockClick}
      />
    )
  }

  return (
    <BookingGrid
      courts={courts}
      bookings={bookings}
      date={date}
      gridStart={gridStart}
      gridEnd={gridEnd}
      onCancelBooking={handleCancel}
      onConfirmBooking={handleConfirm}
      onUpdatePayment={updatePaymentStatusAction ? handleUpdatePayment : undefined}
      onUpdateBooking={updateBookingAction ? handleUpdateBooking : undefined}
      onUpdatePlayers={updatePlayersAction ? handleUpdatePlayers : undefined}
      onSearchPlayers={searchPlayersAction ? handleSearchPlayers : undefined}
      highlightBookingId={highlightBookingId}
    />
  )
}
