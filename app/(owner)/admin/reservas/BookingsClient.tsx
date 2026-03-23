'use client'

import { fetchBookingsAction } from '@/actions/owner/bookings'
import { BookingBlock, CourtColumn } from '@/components/booking/BookingGrid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useEffect, useState } from 'react'

interface BookingClientProps {
  initialBookings: BookingBlock[]
  clubId: string
  date: string
  weekStart: string
  weekEnd: string
  viewMode: 'day' | 'week'
  // ── Las que te faltaban declarar ──
  courts: CourtColumn[]
  gridStart: number
  gridEnd: number
  highlightBookingId?: string
}

export default function BookingsClient({
  initialBookings,
  clubId,
  date,
  weekStart,
  weekEnd,
  viewMode,
  ...rest
}: BookingClientProps) {
  const queryClient = useQueryClient()
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const queryPeriodStart = viewMode === 'week' ? weekStart : date
  const queryPeriodEnd = viewMode === 'week' ? weekEnd : date

  const { data: allBookings } = useQuery({
    queryKey: ['bookings', clubId, queryPeriodStart, queryPeriodEnd],
    queryFn: () => fetchBookingsAction(clubId, queryPeriodStart, queryPeriodEnd),
    initialData: initialBookings,
    refetchInterval: 30000,
  })

  useEffect(() => {
    async function handleReservasRefresh(event: Event) {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail
      if (detail?.bookingId) {
        setEventHighlightBookingId(detail.bookingId)
      }
      await queryClient.invalidateQueries({ queryKey: ['bookings', clubId] })
      await queryClient.refetchQueries({ queryKey: ['bookings', clubId], type: 'active' })
    }

    window.addEventListener('reservas:refresh', handleReservasRefresh)
    return () => {
      window.removeEventListener('reservas:refresh', handleReservasRefresh)
    }
  }, [clubId, queryClient])

  useEffect(() => {
    if (!eventHighlightBookingId) return
    const timer = setTimeout(() => setEventHighlightBookingId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [eventHighlightBookingId])

  const bookings = viewMode === 'week' ? allBookings : allBookings.filter((b) => b.date === date)

  return (
    <ReservasShell
      bookings={bookings}
      date={date}
      weekStart={weekStart}
      viewMode={viewMode}
      highlightBookingId={eventHighlightBookingId ?? rest.highlightBookingId}
      {...rest}
    />
  )
}
