'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { PendingCreate } from '@/features/reservas/components/booking-grid/hooks/useBookingDragCreate'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { toast } from 'sonner'
import FloatingBookingForm from '@/features/reservas/components/floating-booking-form/FloatingBookingForm'
import { SLOT_HEIGHT } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'
import { useBookingFormStore } from '@/store/useBookingFormStore'
import DateHeader from './ui/DateHeader/DateHeader'
import NuevaReservaButton from './ui/NuevaReservaButton'
import { addDays, getWeekStart } from '@/lib/date'
import type { DayGridData } from './page'

export type FloatingFormInitialData = {
  date: string
  courtId?: string
  startTime?: string
  durationMinutes?: number
  mode: 'full' | 'quick'
}

interface BookingClientProps {
  initialBookings: BookingBlock[]
  clubId: string
  clubName: string
  weekStart: string
  initialSelectedDate: string
  weekData: Record<string, DayGridData>
  highlightBookingId?: string
  conflicts?: { id: string; dateStr: string }[]
}

export default function BookingsClient({
  initialBookings,
  clubId,
  clubName,
  weekStart,
  initialSelectedDate,
  weekData,
  conflicts = [],
  highlightBookingId,
}: BookingClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate)
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [show24Hours, setShow24Hours] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const queryClient = useQueryClient()
  const prevDateRef = useRef('')
  const { isOpen, anchorEl, virtualCoords, initialData, openForm, closeForm } = useBookingFormStore()
  const [initialDataTimestamp] = useState(() => Date.now())
  const dragCancelRef = useRef<(() => void) | null>(null)
  const dragCreatedRef = useRef<((bookingId?: string) => void) | null>(null)

  // ── Derived grid data for selected day ──────────────────────────────────
  const { courtColumns: courts, baseStart, baseEnd, baseBookingRule } =
    weekData[selectedDate] ?? weekData[weekStart]

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  // ── Day navigation ───────────────────────────────────────────────────────
  function handleDayChange(newDate: string) {
    const newWeekStart = getWeekStart(newDate)
    if (newWeekStart === weekStart) {
      setSelectedDate(newDate)
      window.history.replaceState(null, '', `/admin/reservas?date=${newDate}`)
    } else {
      startTransition(() => router.push(`/admin/reservas?date=${newDate}`))
    }
  }

  // ── React Query — week-level cache ───────────────────────────────────────
  const { data: allWeekBookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, 'week', weekStart],
    queryFn: () => fetchBookingsAction(clubId, weekStart, weekEnd),
    initialData: initialBookings,
    initialDataUpdatedAt: initialDataTimestamp,
    refetchInterval: 30_000,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const bookings = useMemo(
    () => allWeekBookings.filter((b) => b.date === selectedDate),
    [allWeekBookings, selectedDate]
  )

  // ── Prefetch adjacent weeks ──────────────────────────────────────────────
  // Runs once per week change. prefetchQuery respects staleTime: if data is
  // already fresh in cache it's a no-op — no extra network request.
  useEffect(() => {
    const prevStart = addDays(weekStart, -7)
    const nextStart = addDays(weekStart, 7)
    queryClient.prefetchQuery({
      queryKey: ['bookings', clubId, 'week', prevStart],
      queryFn: () => fetchBookingsAction(clubId, prevStart, addDays(prevStart, 6)),
      staleTime: 5 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: ['bookings', clubId, 'week', nextStart],
      queryFn: () => fetchBookingsAction(clubId, nextStart, addDays(nextStart, 6)),
      staleTime: 5 * 60 * 1000,
    })
  }, [weekStart, clubId, queryClient])

  // ── Conflict counts ──────────────────────────────────────────────────────
  const conflictIds = useMemo(() => new Set(conflicts.map((c) => c.id)), [conflicts])
  const todayConflictCount = useMemo(
    () => conflicts.filter((c) => c.dateStr === selectedDate).length,
    [conflicts, selectedDate]
  )
  const totalConflictCount = conflicts.length

  useEffect(() => {
    if (prevDateRef.current !== selectedDate) {
      prevDateRef.current = selectedDate
      if (todayConflictCount > 0) {
        toast.warning(
          `${todayConflictCount} reserva${todayConflictCount !== 1 ? 's' : ''} de hoy requiere${todayConflictCount !== 1 ? 'n' : ''} atención`,
          {
            action: { label: 'Ver conflictos', onClick: () => router.push('/admin/conflictos') },
            position: 'bottom-right',
            duration: 6000,
          }
        )
      }
    }
  }, [selectedDate, todayConflictCount, router])

  useEffect(() => {
    if (!eventHighlightBookingId) return
    const timer = setTimeout(() => setEventHighlightBookingId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [eventHighlightBookingId])

  // ── Floating form handlers ───────────────────────────────────────────────
  function handleFormCreated(bookingId?: string) {
    dragCreatedRef.current?.(bookingId)
    dragCreatedRef.current = null
    dragCancelRef.current = null
    closeForm()
    if (bookingId) setEventHighlightBookingId(bookingId)
  }

  function handleCellClick(courtId: string, slotMinutes: number, cellRect?: DOMRect, availableMinutes?: number) {
    if (isOpen) { closeForm(); return }
    const defaultDuration = 60
    if (availableMinutes !== undefined && availableMinutes < defaultDuration) {
      toast.warning(`No hay suficiente tiempo disponible. El mínimo para esta cancha es de ${defaultDuration} minutos.`)
      return
    }
    const coords = cellRect
      ? { x: cellRect.left, y: cellRect.top, width: cellRect.width, height: (defaultDuration / 30) * SLOT_HEIGHT }
      : undefined
    openForm(
      { date: selectedDate, courtId, startTime: minutesToTime(slotMinutes), durationMinutes: defaultDuration, mode: 'quick' },
      null,
      coords
    )
  }

  function handleDragCreateReady(pending: PendingCreate, cancel: () => void, created: (bookingId?: string) => void) {
    dragCancelRef.current = cancel
    dragCreatedRef.current = created
    openForm(
      { date: selectedDate, courtId: pending.courtId, startTime: minutesToTime(pending.ghost.startMin), durationMinutes: pending.ghost.durationMinutes, mode: 'quick' },
      null,
      pending.ghostRect
    )
  }

  // ── Grid bounds ──────────────────────────────────────────────────────────
  const gridStart = show24Hours ? 0 : (baseStart ?? 8 * 60)
  const gridEnd = show24Hours ? 1440 : (baseEnd ?? 23 * 60)
  const handleToggle24Hours = useCallback(() => setShow24Hours((v) => !v), [])

  const activeDraft = useMemo(() => {
    if (!initialData?.courtId || !initialData?.startTime) return null
    return {
      courtId: initialData.courtId,
      startMin: timeToMinutes(initialData.startTime),
      durationMinutes: initialData.durationMinutes ?? 60,
    }
  }, [initialData])

  const hasHiddenBookings = useMemo(
    () =>
      !show24Hours &&
      (baseStart !== undefined || baseEnd !== undefined) &&
      bookings.some((b) => {
        const start = timeToMinutes(b.startTime)
        const end = start + b.durationMinutes
        return start < (baseStart ?? 0) || end > (baseEnd ?? 1440)
      }),
    [show24Hours, baseStart, baseEnd, bookings]
  )

  const dateLabel = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00.000Z`)
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  }, [selectedDate])

  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border print:static print:border-0">
        <div className="pl-4 pr-4 py-2.5 flex items-center gap-3 print:hidden">
          <DateHeader
            selectedDate={selectedDate}
            clubId={clubId}
            onDayChange={handleDayChange}
            isPending={isPending}
          />
          <div className="flex-1" />
          <NuevaReservaButton date={selectedDate} />
        </div>
        <div className="hidden print:block px-5 py-3">
          <h1 className="text-lg font-bold capitalize">{dateLabel}</h1>
          <p className="text-sm text-gray-600">{clubName}</p>
        </div>
      </div>

      {/* ── Fetch progress bar ──────────────────────────────────────────── */}
      {isFetching && (
        <div className="h-0.5 overflow-hidden">
          <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 print:overflow-visible print:h-auto">
        <ReservasShell
          bookings={bookings}
          date={selectedDate}
          clubId={clubId}
          courts={courts}
          gridStart={gridStart}
          gridEnd={gridEnd}
          baseStart={baseStart}
          baseEnd={baseEnd}
          conflictIds={conflictIds}
          show24Hours={show24Hours}
          onToggle24Hours={handleToggle24Hours}
          hasHiddenBookings={hasHiddenBookings}
          todayConflictCount={todayConflictCount}
          totalConflictCount={totalConflictCount}
          highlightBookingId={eventHighlightBookingId ?? highlightBookingId}
          onCellClick={handleCellClick}
          onDragCreateReady={handleDragCreateReady}
          isFormOpen={isOpen}
          activeDraft={activeDraft}
        />
      </div>

      {/* ── FloatingBookingForm ─────────────────────────────────────────── */}
      {isOpen && initialData && (
        <FloatingBookingForm
          anchorEl={anchorEl}
          virtualCoords={virtualCoords}
          initialData={initialData}
          clubId={clubId}
          courts={courts}
          baseStart={baseStart}
          baseEnd={baseEnd}
          baseBookingRule={baseBookingRule}
          onClose={() => {
            dragCancelRef.current?.()
            dragCancelRef.current = null
            dragCreatedRef.current = null
            closeForm()
          }}
          onCreated={handleFormCreated}
        />
      )}
    </div>
  )
}
