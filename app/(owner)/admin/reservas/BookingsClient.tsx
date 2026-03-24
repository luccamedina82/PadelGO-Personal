'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useEffect, useRef, useState } from 'react'

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
  // Capturamos el timestamp de montaje para que React Query trate los datos SSR como frescos
  const initialDataTimestamp = useRef(Date.now())

  const { data: allBookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, queryPeriodStart, queryPeriodEnd],
    queryFn: () => fetchBookingsAction(clubId, queryPeriodStart, queryPeriodEnd),
    initialData: initialBookings,
    initialDataUpdatedAt: initialDataTimestamp.current,
    refetchInterval: 30_000,
    staleTime: 30_000, // Datos SSR se consideran frescos por 30s, evitando refetch redundante al montar
    gcTime: 5 * 60 * 1000,
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
    <div className="relative h-full min-h-0">
      {/* Barra de carga superior: visible durante refetch de React Query */}
      {isFetching && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 overflow-hidden rounded-t-2xl">
          <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <ReservasShell
        bookings={bookings}
        date={date}
        weekStart={weekStart}
        viewMode={viewMode}
        highlightBookingId={eventHighlightBookingId ?? rest.highlightBookingId}
        {...rest}
      />
    </div>
  )
}
