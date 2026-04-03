'use client'

import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { PendingCreate } from '@/features/reservas/components/booking-grid/hooks/useBookingDragCreate'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReservasShell from './ReservasShell'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { toast } from 'sonner'
import FloatingBookingForm from '@/features/reservas/components/floating-booking-form/FloatingBookingForm'
import { SLOT_HEIGHT } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'

// ── Floating form state types ────────────────────────────────────────────────

export type FloatingFormInitialData = {
  date: string
  courtId?: string
  startTime?: string
  durationMinutes?: number
  mode: 'full' | 'quick'
}

type FloatingFormState = {
  anchorEl: HTMLElement | null
  virtualCoords?: { x: number; y: number; width: number; height: number }
  initialData: FloatingFormInitialData
} | null

// ── Component ────────────────────────────────────────────────────────────────

interface BookingClientProps {
  initialBookings: BookingBlock[]
  clubId: string
  date: string
  courts: CourtColumn[]
  baseStart?: number
  baseEnd?: number
  highlightBookingId?: string
  conflicts?: { id: string; dateStr: string }[]
  baseBookingRule?: { startTime: string; endTime: string; price: number | null } | null
}

export default function BookingsClient({
  initialBookings,
  clubId,
  date,
  courts,
  conflicts = [],
  baseStart,
  baseEnd,
  highlightBookingId,
  baseBookingRule,
}: BookingClientProps) {
  const queryClient = useQueryClient()
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)
  const [show24Hours, setShow24Hours] = useState(false)
  const router = useRouter()
  const prevDateRef = useRef('')

  const [initialDataTimestamp] = useState(() => Date.now())

  // ── Floating form state ──────────────────────────────────────────────────
  const [floatingForm, setFloatingForm] = useState<FloatingFormState>(null)
  const dragCancelRef = useRef<(() => void) | null>(null)
  const dragCreatedRef = useRef<((bookingId?: string) => void) | null>(null)

  function openFloatingForm(
    anchorEl: HTMLElement | null,
    initialData: FloatingFormInitialData,
    virtualCoords?: { x: number; y: number; width: number; height: number }
  ) {
    setFloatingForm({ anchorEl, virtualCoords, initialData })
  }

  function closeFloatingForm() {
    dragCancelRef.current?.()
    dragCancelRef.current = null
    dragCreatedRef.current = null
    setFloatingForm(null)
  }

  function handleFormCreated(bookingId?: string) {
    dragCreatedRef.current?.(bookingId)
    dragCreatedRef.current = null
    dragCancelRef.current = null
    setFloatingForm(null)
  }

  // ── Entry point: Global button (custom event from NuevaReservaButton) ────
  useEffect(() => {
    function onNuevaReserva(e: Event) {
      const detail = (e as CustomEvent<{ date?: string; courtId?: string; startTime?: string; buttonEl?: HTMLElement }>).detail
      const hasContext = !!(detail?.courtId && detail?.startTime)
      openFloatingForm(
        detail?.buttonEl ?? null,
        {
          date: detail?.date ?? date,
          courtId: detail?.courtId,
          startTime: detail?.startTime,
          mode: hasContext ? 'quick' : 'full',
        }
      )
    }
    window.addEventListener('reservas:nueva-reserva', onNuevaReserva)
    return () => window.removeEventListener('reservas:nueva-reserva', onNuevaReserva)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // ── Entry point: Grid cell click ─────────────────────────────────────────
  function handleCellClick(courtId: string, slotMinutes: number, cellRect?: DOMRect, availableMinutes?: number) {
    // Shield: if form is already open, first click outside just closes it
    if (floatingForm !== null) {
      closeFloatingForm()
      return
    }
    const court = courts.find((c) => c.id === courtId)
    const defaultDuration = court?.allowedDurations[0] ?? 60
    // Abort if not even the minimum duration fits
    if (availableMinutes !== undefined && availableMinutes < defaultDuration) return
    // Use the full cell rect as anchor — floating-ui flip works correctly with real column bounds
    const coords = cellRect
      ? {
          x: cellRect.left,
          y: cellRect.top,
          width: cellRect.width,
          height: (defaultDuration / 30) * SLOT_HEIGHT,
        }
      : undefined
    openFloatingForm(
      null,
      { date, courtId, startTime: minutesToTime(slotMinutes), durationMinutes: defaultDuration, mode: 'quick' },
      coords
    )
  }

  // ── Entry point: Drag-to-create ──────────────────────────────────────────
  function handleDragCreateReady(
    pending: PendingCreate,
    cancel: () => void,
    created: (bookingId?: string) => void
  ) {
    dragCancelRef.current = cancel
    dragCreatedRef.current = created
    openFloatingForm(
      null,
      {
        date,
        courtId: pending.courtId,
        startTime: minutesToTime(pending.ghost.startMin),
        durationMinutes: pending.ghost.durationMinutes,
        mode: 'quick',
      },
      pending.ghostRect
    )
  }

  // ── Conflict data ────────────────────────────────────────────────────────
  const conflictIds = useMemo(() => new Set(conflicts.map((c) => c.id)), [conflicts])
  const todayConflictCount = useMemo(
    () => conflicts.filter((c) => c.dateStr === date).length,
    [conflicts, date]
  )
  const totalConflictCount = conflicts.length

  // ── Active draft ghost (single cell-click, while form is open) ──────────
  const activeDraft = useMemo(() => {
    if (!floatingForm?.initialData.courtId || !floatingForm?.initialData.startTime) return null
    return {
      courtId: floatingForm.initialData.courtId,
      startMin: timeToMinutes(floatingForm.initialData.startTime),
      durationMinutes: floatingForm.initialData.durationMinutes ?? 60,
    }
  }, [floatingForm])

  // ── Grid bounds ──────────────────────────────────────────────────────────
  const gridStart = show24Hours ? 0 : (baseStart ?? 8 * 60)
  const gridEnd = show24Hours ? 1440 : (baseEnd ?? 23 * 60)

  const handleToggle24Hours = useCallback(() => setShow24Hours((v) => !v), [])

  useEffect(() => {
    function onNavigating() { setIsNavigating(true) }
    window.addEventListener('reservas:date-navigating', onNavigating)
    return () => window.removeEventListener('reservas:date-navigating', onNavigating)
  }, [])

  useEffect(() => {
    setIsNavigating(false)
  }, [date])

  useEffect(() => {
    if (prevDateRef.current === date) return
    prevDateRef.current = date
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="flex-1 min-h-0">
        <ReservasShell
          bookings={bookings}
          date={date}
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
          isNavigating={isNavigating}
          highlightBookingId={eventHighlightBookingId ?? highlightBookingId}
          onCellClick={handleCellClick}
          onDragCreateReady={handleDragCreateReady}
          isFormOpen={!!floatingForm}
          activeDraft={activeDraft}
        />
      </div>

      {/* FloatingBookingForm */}
      {floatingForm && (
        <FloatingBookingForm
          anchorEl={floatingForm.anchorEl}
          virtualCoords={floatingForm.virtualCoords}
          initialData={floatingForm.initialData}
          clubId={clubId}
          courts={courts}
          baseStart={baseStart}
          baseEnd={baseEnd}
          baseBookingRule={baseBookingRule}
          onClose={closeFloatingForm}
          onCreated={handleFormCreated}
        />
      )}
    </div>
  )
}
