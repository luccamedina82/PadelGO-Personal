'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import ReservasShell from './ReservasShell'
import { useEffect, useState } from 'react'

interface BookingClientProps {
  initialBookings: BookingBlock[]
  clubId: string
  date: string
  courts: CourtColumn[]
  gridStart: number
  gridEnd: number
  highlightBookingId?: string
}

export default function BookingsClient({
  initialBookings,
  clubId,
  date,
  ...rest
}: BookingClientProps) {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()

  const urlDate = searchParams.get('date')
  const isNavigatingToDate = urlDate !== null && urlDate !== date
  const [initialDataTimestamp] = useState(() => Date.now())

  const { data: allBookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, date],
    queryFn: () => fetchBookingsAction(clubId, date, date),
    initialData: initialBookings,
    initialDataUpdatedAt: initialDataTimestamp,
    refetchInterval: 30_000,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    async function handleReservasRefresh(event: Event) {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail
      if (detail?.bookingId) {
        setEventHighlightBookingId(detail.bookingId)
      }

      const exactQueryKey = ['bookings', clubId, date] as const

      await queryClient.invalidateQueries({
        queryKey: exactQueryKey,
        exact: true,
      })

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
  }, [clubId, queryClient, date])

  useEffect(() => {
    if (!eventHighlightBookingId) return
    const timer = setTimeout(() => setEventHighlightBookingId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [eventHighlightBookingId])

  const bookings = allBookings.filter((b) => b.date === date)

  return (
    <div className="relative h-full min-h-0">
      {/* Overlay de navegación entre días: blur + spinner */}
      {isNavigatingToDate && (
        <div className="absolute inset-0 z-[25] bg-bg/60 backdrop-blur-[2px] flex items-center justify-center animate-fadeIn-delayed">
          <div className="w-9 h-9 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
      )}
      {/* Barra de carga superior: visible durante refetch de React Query (polling) */}
      {isFetching && !isNavigatingToDate && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 overflow-hidden rounded-t-2xl">
          <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <ReservasShell
        bookings={bookings}
        date={date}
        clubId={clubId}
        highlightBookingId={eventHighlightBookingId ?? rest.highlightBookingId}
        {...rest}
      />
    </div>
  )
}
