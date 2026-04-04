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
import { useBookingFormStore } from '@/store/useBookingFormStore'

// ── Floating form state types ────────────────────────────────────────────────

export type FloatingFormInitialData = {
  date: string
  courtId?: string
  startTime?: string
  durationMinutes?: number
  mode: 'full' | 'quick'
}

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
  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [show24Hours, setShow24Hours] = useState(false)
  const router = useRouter()
  const prevDateRef = useRef('')
  const { isOpen, anchorEl, virtualCoords, initialData, openForm, closeForm } = useBookingFormStore()

  const [initialDataTimestamp] = useState(() => Date.now())

  // ── Floating form state ──────────────────────────────────────────────────
  const dragCancelRef = useRef<(() => void) | null>(null)
  const dragCreatedRef = useRef<((bookingId?: string) => void) | null>(null)


  function handleFormCreated(bookingId?: string) {
    dragCreatedRef.current?.(bookingId)
    dragCreatedRef.current = null
    dragCancelRef.current = null
    closeForm()
    if (bookingId) {
      setEventHighlightBookingId(bookingId)
    }
  }


  // ── Entry point: Grid cell click ─────────────────────────────────────────
  function handleCellClick(courtId: string, slotMinutes: number, cellRect?: DOMRect, availableMinutes?: number) {
    // Shield: if form is already open, first click outside just closes it
    if (isOpen) {
      closeForm()
      return
    }
    const court = courts.find((c) => c.id === courtId)
    const defaultDuration = court?.allowedDurations[0] ?? 60
    // Abort if not even the minimum duration fits

    if (availableMinutes !== undefined && availableMinutes < defaultDuration) {
      toast.warning(`No hay suficiente tiempo disponible. El mínimo para esta cancha es de ${defaultDuration} minutos.`)
      return
    }
    // Use the full cell rect as anchor — floating-ui flip works correctly with real column bounds
    const coords = cellRect
      ? {
          x: cellRect.left,
          y: cellRect.top,
          width: cellRect.width,
          height: (defaultDuration / 30) * SLOT_HEIGHT,
        }
      : undefined
    openForm(
      { date, courtId, startTime: minutesToTime(slotMinutes), durationMinutes: defaultDuration, mode: 'quick' },
      null,
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
    openForm(
      { date, courtId: pending.courtId, startTime: minutesToTime(pending.ghost.startMin), durationMinutes: pending.ghost.durationMinutes, mode: 'quick' },
      null,
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
    if (!initialData?.courtId || !initialData?.startTime) return null
    return {
      courtId: initialData.courtId,
      startMin: timeToMinutes(initialData.startTime),
      durationMinutes: initialData.durationMinutes ?? 60,
    }
  }, [initialData])

  // ── Grid bounds ──────────────────────────────────────────────────────────
  const gridStart = show24Hours ? 0 : (baseStart ?? 8 * 60)
  const gridEnd = show24Hours ? 1440 : (baseEnd ?? 23 * 60)

  const handleToggle24Hours = useCallback(() => setShow24Hours((v) => !v), [])

  useEffect(() => {
    // Si es la primera vez que renderiza o cambió la fecha, evaluamos
    if (prevDateRef.current !== date) {
      prevDateRef.current = date; // Actualizamos la ref al día actual
      
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
  }, [date, todayConflictCount, router])


  const { data: bookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, date],
    queryFn: () => fetchBookingsAction(clubId, date, date),
    initialData: initialBookings,
    initialDataUpdatedAt: initialDataTimestamp,
    refetchInterval: 30_000,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!eventHighlightBookingId) return
    const timer = setTimeout(() => setEventHighlightBookingId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [eventHighlightBookingId])


  const hasHiddenBookings = useMemo(() => {
    return !show24Hours &&
      (baseStart !== undefined || baseEnd !== undefined) &&
      bookings.some((b) => {
        const start = timeToMinutes(b.startTime)
        const end = start + b.durationMinutes
        return start < (baseStart ?? 0) || end > (baseEnd ?? 1440)
      })
  }, [show24Hours, baseStart, baseEnd, bookings])

  return (
    <div className="relative h-full min-h-0 flex flex-col">
      {isFetching && (
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
          highlightBookingId={eventHighlightBookingId ?? highlightBookingId}
          onCellClick={handleCellClick}
          onDragCreateReady={handleDragCreateReady}
          isFormOpen={isOpen}
          activeDraft={activeDraft}
        />
      </div>

      {/* FloatingBookingForm */}
      {isOpen && initialData &&(
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
