'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { timeToMinutes } from '@/lib/availability'

interface BookingClientProps {
  initialBookings: BookingBlock[]
  clubId: string
  date: string
  courts: CourtColumn[]
  baseStart?: number
  baseEnd?: number
  highlightBookingId?: string
  conflictCount?: number
}

export default function BookingsClient({
  initialBookings,
  clubId,
  date,
  courts,
  conflictCount = 0,
  baseStart,
  baseEnd,
  highlightBookingId,
}: BookingClientProps) {
  const queryClient = useQueryClient()
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)
  const [liveConflictCount, setLiveConflictCount] = useState(conflictCount)
  const [show24Hours, setShow24Hours] = useState(false)
  const [hideMaintenance, setHideMaintenance] = useState(false)
  const router = useRouter()

  const [initialDataTimestamp] = useState(() => Date.now())

  // Compute grid bounds from toggle state
  const gridStart = show24Hours ? 0 : (baseStart ?? 8 * 60)
  const gridEnd = show24Hours ? 1440 : (baseEnd ?? 23 * 60)

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

  const visibleCourts = hideMaintenance
    ? courts.filter((c) => !c.isUnderMaintenance)
    : courts

  // Detect bookings outside the operating window (only relevant when in normal view)
  const hasHiddenBookings =
    !show24Hours &&
    (baseStart !== undefined || baseEnd !== undefined) &&
    bookings.some((b) => {
      const start = timeToMinutes(b.startTime)
      const end = start + b.durationMinutes
      return start < (baseStart ?? 0) || end > (baseEnd ?? 1440)
    })

  return (
    <div className="relative h-full min-h-0 flex flex-col">
      {isFetching && !isNavigating && (
        <div className="absolute top-0 left-0 right-0 z-30 h-0.5 overflow-hidden rounded-t-2xl">
          <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Conflict banner */}
      {liveConflictCount > 0 && (
        <div className="shrink-0 mx-4 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl
                        bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-[12px] font-semibold flex-1">
            ⚠️ {liveConflictCount} reserva{liveConflictCount !== 1 ? 's' : ''} requiere{liveConflictCount !== 1 ? 'n' : ''} tu atención por conflictos
          </p>
          <a
            href="/admin/conflictos"
            className="text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40
                       hover:bg-amber-500/30 transition-colors whitespace-nowrap"
          >
            Ver conflictos
          </a>
        </div>
      )}

      {/* toolbar: hidden bookings indicator + toggles */}
      <div className="shrink-0 flex items-center justify-end gap-2.5 px-4 pt-2 pb-0.5">
        {hasHiddenBookings && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            Turnos fuera de horario
          </span>
        )}

        {/* Hide maintenance toggle */}
        {courts.some((c) => c.isUnderMaintenance) && (
          <button
            onClick={() => setHideMaintenance((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors
                        ${hideMaintenance
                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                          : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                        }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            {hideMaintenance ? 'Mostrar mantenimiento' : 'Ocultar mantenimiento'}
          </button>
        )}

        {/* 24h toggle */}
        <button
          onClick={() => setShow24Hours((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors
                      ${show24Hours
                        ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
                        : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
                      }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {show24Hours ? 'Horario operativo' : 'Ver 24 hs'}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <ReservasShell
          bookings={bookings}
          date={date}
          clubId={clubId}
          courts={visibleCourts}
          gridStart={gridStart}
          gridEnd={gridEnd}
          baseStart={baseStart}
          baseEnd={baseEnd}
          isNavigating={isNavigating}
          highlightBookingId={eventHighlightBookingId ?? highlightBookingId}
        />
      </div>

    </div>
  )
}
