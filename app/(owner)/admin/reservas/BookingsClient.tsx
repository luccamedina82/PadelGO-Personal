'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
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
    staleTime: 0, // Fresh data always considered stale, forcing refetch when explicit
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  useEffect(() => {
    async function handleReservasRefresh(event: Event) {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail
      if (detail?.bookingId) {
        setEventHighlightBookingId(detail.bookingId)
      }

      // Invalidate the EXACT query key that's currently active
      const exactQueryKey = ['bookings', clubId, queryPeriodStart, queryPeriodEnd] as const
      
      await queryClient.invalidateQueries({
        queryKey: exactQueryKey,
        exact: true, // Use exact match for precision
      })

      // Refetch the exact query
      await queryClient.refetchQueries({
        queryKey: exactQueryKey,
        type: 'active',
        exact: true,
      })
    }

    window.addEventListener('reservas:refresh', handleReservasRefresh)
    return () => {
      window.removeEventListener('reservas:refresh', handleReservasRefresh)
    }
  }, [clubId, queryClient, queryPeriodStart, queryPeriodEnd])

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
