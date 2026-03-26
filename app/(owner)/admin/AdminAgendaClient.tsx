'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import AgendaView from '@/features/reservas/components/agenda-view/AgendaView'
import type { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

interface AdminAgendaClientProps {
  initialBookings: BookingBlock[]
  courts: CourtColumn[]
  clubId: string
  date: string
}

export default function AdminAgendaClient({
  initialBookings,
  courts,
  clubId,
  date,
}: AdminAgendaClientProps) {
  const [initialDataTimestamp] = useState(() => Date.now())

  const { data: bookings } = useQuery({
    queryKey: ['admin-bookings', clubId, date],
    queryFn: () => fetchBookingsAction(clubId, date, date),
    initialData: initialBookings,
    initialDataUpdatedAt: initialDataTimestamp,
    refetchInterval: 60_000,
    staleTime: 60_000,
  })

  return <AgendaView bookings={bookings} courts={courts} clubId={clubId} />
}
