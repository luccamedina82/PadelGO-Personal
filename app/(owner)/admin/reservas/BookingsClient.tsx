'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()

  const [initialDataTimestamp] = useState(() => Date.now())

  useEffect(() => {
    function onNavigating() { setIsNavigating(true) }
    window.addEventListener('reservas:date-navigating', onNavigating)
    return () => window.removeEventListener('reservas:date-navigating', onNavigating)
  }, [])

  useEffect(() => {
    setIsNavigating(false)
  }, [date])

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
      const detail = (event as CustomEvent<{ date?: string; bookingId?: string }>).detail
      const targetDate = detail?.date
      const bookingId = detail?.bookingId

      if (bookingId) setEventHighlightBookingId(bookingId)

      if (targetDate && targetDate !== date) {
        queryClient.invalidateQueries({ queryKey: ['bookings', clubId, targetDate], exact: true })
        setTimeout(() => {
          router.push(`/admin/reservas?date=${targetDate}${bookingId ? '&new=' + bookingId : ''}`)
        }, 150)
      } else {
        const exactQueryKey = ['bookings', clubId, date] as const
        await queryClient.invalidateQueries({ queryKey: exactQueryKey, exact: true })
        await queryClient.refetchQueries({ queryKey: exactQueryKey, type: 'active', exact: true })
      }
    }

    window.addEventListener('reservas:refresh', handleReservasRefresh)
    return () => window.removeEventListener('reservas:refresh', handleReservasRefresh)
  }, [clubId, queryClient, date, router])

  useEffect(() => {
    if (!eventHighlightBookingId) return
    const timer = setTimeout(() => setEventHighlightBookingId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [eventHighlightBookingId])

  const bookings = allBookings.filter((b) => b.date === date)

  return (
    <div className="relative h-full min-h-0">
      {isFetching && !isNavigating && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 overflow-hidden rounded-t-2xl">
          <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <ReservasShell
        bookings={bookings}
        date={date}
        clubId={clubId}
        isNavigating={isNavigating}
        highlightBookingId={eventHighlightBookingId ?? rest.highlightBookingId}
        {...rest}
      />
    </div>
  )
}
