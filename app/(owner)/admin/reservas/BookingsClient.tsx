'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays } from '@/lib/date'
import { minutesToTime, timeToMinutes, type BookingRuleInput } from '@/lib/availability'
import { prepareGridData } from '@/lib/utils/gridHelpers'
import { SLOT_HEIGHT } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'
import { fetchBookingsAction } from '@/features/reservas/actions/bookings'
import { BookingBlock, CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { PendingCreate } from '@/features/reservas/components/booking-grid/hooks/useBookingDragCreate'
import dynamic from 'next/dynamic'
import ReservasShell from './ReservasShell'
const FloatingBookingForm = dynamic(
  () => import('@/features/reservas/components/floating-booking-form/FloatingBookingForm'),
  { ssr: false }
)
const BookingDrawer = dynamic(
  () => import('@/features/reservas/components/booking-drawer/BookingDrawer'),
  { ssr: false }
)
import { useBookingFormStore } from '@/store/useBookingFormStore'
import { useBookingsContext, useCourtsContext } from './BookingsContext'
import { useReservasSidebarStore } from '@/store/reservasSidebarStore'
import { BLOCK_SOURCES } from '@/features/reservas/constants/bookingSources'

export type FloatingFormInitialData = {
  date: string
  courtId?: string
  startTime?: string
  durationMinutes?: number
  mode: 'full' | 'quick'
  /** true = duración elegida explícitamente (drag). false = default sugerido (clic) */
  durationLocked?: boolean
}

type DayGridData = {
  courtColumns: CourtColumn[]
  baseStart: number
  baseEnd: number
  baseBookingRule: { startTime: string; endTime: string; price: number | null } | null
}

// Replicates getBaseBookingRulesForWeek logic on the client.
// clubRules already contains all global booking rules (no courtIds);
// we filter for priority-0 to find the "base" display rule per day.
function findBaseRuleForDay(clubRules: BookingRuleInput[], dayStr: string) {
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`)
  const dayEnd = new Date(`${dayStr}T23:59:59.999Z`)
  const baseRules = clubRules
    .filter((r) => r.priority === 0)
    .sort((a, b) => {
      // More-specific (later activeFrom) rules win, same as server ORDER BY activeFrom DESC
      const at = a.activeFrom ? new Date(a.activeFrom).getTime() : 0
      const bt = b.activeFrom ? new Date(b.activeFrom).getTime() : 0
      return bt - at
    })
  return (
    baseRules.find((r) => {
      const from = r.activeFrom ? new Date(r.activeFrom) : null
      const until = r.activeUntil ? new Date(r.activeUntil) : null
      return (from == null || from <= dayEnd) && (until == null || until >= dayStart)
    }) ?? null
  )
}

interface BookingClientProps {
  initialBookings: BookingBlock[]
  /** The weekStart that was rendered on SSR — used to scope initialData. */
  initialWeekStart: string
  clubId: string
  highlightBookingId?: string
}

export default function BookingsClient({
  initialBookings,
  initialWeekStart,
  clubId,
  highlightBookingId,
}: BookingClientProps) {
  const { selectedDate, weekStart, handleDayChange } = useBookingsContext()
  const { allCourts, clubRules, conflicts } = useCourtsContext()

  const [eventHighlightBookingId, setEventHighlightBookingId] = useState<string | undefined>()
  const [show24Hours, setShow24Hours] = useState(false)
  const [focusCourtIds, setFocusCourtIds] = useState<string[]>([])
  const router = useRouter()
  const queryClient = useQueryClient()
  const prevDateRef = useRef('')
  const { isOpen, anchorEl, virtualCoords, initialData, openForm, closeForm } = useBookingFormStore()
  const [initialDataTimestamp] = useState(() => Date.now())
  const dragCancelRef = useRef<(() => void) | null>(null)
  const dragCreatedRef = useRef<((bookingId?: string) => void) | null>(null)
  const drawerPrefillRef = useRef<{ courtId: string; startTime: string; duration: number } | null>(null)

  // ── Compute weekData client-side from stable courts/rules in context ────────
  // Runs synchronously on week change — no server round-trip needed.
  const weekData = useMemo<Record<string, DayGridData>>(() => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const data: Record<string, DayGridData> = {}
    weekDays.forEach((day) => {
      const dayOfWeek = new Date(`${day}T00:00:00.000Z`).getUTCDay()
      const rule = findBaseRuleForDay(clubRules, day)
      const { courtColumns, baseStart, baseEnd } = prepareGridData(allCourts, clubRules, rule, dayOfWeek)
      data[day] = {
        courtColumns,
        baseStart,
        baseEnd,
        baseBookingRule: rule
          ? { startTime: rule.startTime, endTime: rule.endTime, price: rule.price }
          : null,
      }
    })
    return data
  }, [weekStart, allCourts, clubRules])

  const { courtColumns: courts, baseStart, baseEnd, baseBookingRule } =
    weekData[selectedDate] ?? weekData[weekStart]

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

  // ── React Query — week-level cache ──────────────────────────────────────────
  // initialData only applies to the SSR week; other weeks fetch from the server.
  // keepPreviousData means week-change shows old data (filtered to empty by date)
  // while new bookings load — grid structure stays visible, progress bar shows.
  const { data: allWeekBookings, isFetching } = useQuery({
    queryKey: ['bookings', clubId, 'week', weekStart],
    queryFn: () => fetchBookingsAction(clubId, weekStart, weekEnd),
    initialData: weekStart === initialWeekStart ? initialBookings : undefined,
    initialDataUpdatedAt: weekStart === initialWeekStart ? initialDataTimestamp : undefined,
    refetchInterval: 30_000,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const bookings = useMemo(
    () => (allWeekBookings ?? []).filter((b) => b.date === selectedDate),
    [allWeekBookings, selectedDate]
  )

  // ── Prefetch adjacent weeks ─────────────────────────────────────────────────
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

  // ── Court visibility (lifted so sidebar can also toggle) ────────────────────
  const toggleCourt = useCallback((id: string) => {
    setFocusCourtIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])
  const clearCourts = useCallback(() => setFocusCourtIds([]), [])

  // Keep refs stable so sidebar store closure never goes stale
  const toggleCourtRef = useRef(toggleCourt)
  const clearCourtsRef = useRef(clearCourts)
  const handleDayChangeRef = useRef(handleDayChange)
  toggleCourtRef.current = toggleCourt
  clearCourtsRef.current = clearCourts
  handleDayChangeRef.current = handleDayChange

  // ── Sidebar slot wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    const store = useReservasSidebarStore.getState()
    store.activate()
    store.syncHandlers(
      (d) => handleDayChangeRef.current(d),
      (id) => toggleCourtRef.current(id),
      () => clearCourtsRef.current(),
    )
    return () => useReservasSidebarStore.getState().deactivate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    useReservasSidebarStore.getState().syncDate(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courts = allCourts.map((c: any, i: number) => ({
      id: c.id,
      name: c.name,
      colorIndex: i,
      isUnderMaintenance: c.isUnderMaintenance ?? false,
    }))
    useReservasSidebarStore.getState().syncCourts(courts)

    // Maintenance courts off by default — only when user hasn't customized yet
    const hasMaintenance = courts.some(c => c.isUnderMaintenance)
    if (hasMaintenance) {
      setFocusCourtIds(prev => {
        if (prev.length > 0) return prev
        return courts.filter(c => !c.isUnderMaintenance).map(c => c.id)
      })
    }
  }, [allCourts])

  useEffect(() => {
    useReservasSidebarStore.getState().syncFocusCourtIds(focusCourtIds)
  }, [focusCourtIds])

  // ── Conflict counts ─────────────────────────────────────────────────────────
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

  // ── Floating form handlers ──────────────────────────────────────────────────
  function handleFormCreated(bookingId?: string) {
    dragCreatedRef.current?.(bookingId)
    dragCreatedRef.current = null
    dragCancelRef.current = null
    closeForm()
    if (bookingId) setEventHighlightBookingId(bookingId)
  }

  function handleCellClick(courtId: string, slotMinutes: number, cellRect?: DOMRect, availableMinutes?: number) {
    if (isOpen) { closeForm(); return }
    const baseRule = findBaseRuleForDay(clubRules, selectedDate)
    const firstBaseDuration = baseRule?.allowedDurations?.[0] ?? 60
    const defaultDuration = Math.min(firstBaseDuration, availableMinutes ?? firstBaseDuration)
    const coords = cellRect
      ? { x: cellRect.left, y: cellRect.top, width: cellRect.width, height: (defaultDuration / 30) * SLOT_HEIGHT }
      : undefined
    openForm(
      { date: selectedDate, courtId, startTime: minutesToTime(slotMinutes), durationMinutes: defaultDuration, mode: 'quick', durationLocked: false },
      null,
      coords
    )
  }

  function handleDragCreateReady(pending: PendingCreate, cancel: () => void, created: (bookingId?: string) => void) {
    dragCancelRef.current = cancel
    dragCreatedRef.current = created
    openForm(
      { date: selectedDate, courtId: pending.courtId, startTime: minutesToTime(pending.ghost.startMin), durationMinutes: pending.ghost.durationMinutes, mode: 'quick', durationLocked: true },
      null,
      pending.ghostRect
    )
  }

  // ── Sidebar stats sync ───────────────────────────────────────────────────────
  const todayUnpaid = useMemo(
    () => bookings.filter(b =>
      b.status !== 'CANCELLED' &&
      !BLOCK_SOURCES.has(b.source) &&
      b.paymentStatus !== 'PAID' &&
      b.paymentStatus !== 'MANUAL'
    ).length,
    [bookings]
  )
  useEffect(() => {
    useReservasSidebarStore.getState().syncStats(bookings.length, todayUnpaid)
  }, [bookings.length, todayUnpaid])

  // ── Grid bounds ─────────────────────────────────────────────────────────────
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

  return (
    <>
      {/* ── Fetch progress bar ─────────────────────────────────────────────── */}
      <div className={`h-0.5 overflow-hidden transition-opacity duration-200 ${isFetching ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-accent animate-[loading-bar_1.2s_ease-in-out_infinite]" />
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
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
          focusCourtIds={focusCourtIds}
          onCourtToggle={toggleCourt}
          onClearCourts={clearCourts}
        />
      </div>

      {/* ── FloatingBookingForm (contextual: clic / drag) ──────────────────── */}
      {isOpen && initialData && initialData.mode === 'quick' && (
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
          onExpandToDrawer={() => {
            dragCancelRef.current?.()
            dragCancelRef.current = null
            dragCreatedRef.current = null
            const date = initialData.date
            if (initialData.courtId && initialData.startTime && initialData.durationMinutes) {
              drawerPrefillRef.current = {
                courtId: initialData.courtId,
                startTime: initialData.startTime,
                duration: initialData.durationMinutes,
              }
            }
            closeForm()
            openForm({ date, mode: 'full' })
          }}
        />
      )}

      {/* ── BookingDrawer (global: botón "Nueva reserva") ──────────────────── */}
      {isOpen && initialData && initialData.mode === 'full' && (
        <BookingDrawer
          clubId={clubId}
          courts={courts}
          initialDate={initialData.date}
          initialCourtId={drawerPrefillRef.current?.courtId}
          initialStartTime={drawerPrefillRef.current?.startTime}
          initialDuration={drawerPrefillRef.current?.duration}
          onClose={() => { drawerPrefillRef.current = null; closeForm() }}
          onCreated={handleFormCreated}
        />
      )}
    </>
  )
}
