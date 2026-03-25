'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingDetailModal from './BookingDetailModal/BookingDetailModal'
import BookingGridFilterBar from './BookingGridFilterBar/BookingGridFilterBar'
import BookingGridHeader from './BookingGridHeader/BookingGridHeader'
import BookingGridTimeColumn from './BookingGridTimeColumn/BookingGridTimeColumn'
import BookingBlockCell from './BookingBlockCell/BookingBlockCell'
import BookingGridTooltips from './BookingGridTooltips/BookingGridTooltips'
import BookingGridSkeleton from './BookingGridSkeleton/BookingGridSkeleton'
import { useBookingDragResize } from './hooks/useBookingDragResize'
import type {
  BookingBlock,
  BookingGridProps,
  CourtColumn,
  UpdateBookingData,
} from './types/bookingGrid.types'
import {
  SLOT_HEIGHT,
  TIME_COL_WIDTH,
  TOOLTIP_DELAY_MS,
  clampTooltipPosition,
  getBlockClass,
  getLocalDateStr,
  minutesToTime,
  shouldUpdateTooltipPosition,
  timeToMinutes,
  type SourceFilterKey,
} from './helpers/bookingGrid.helpers'

export type { BookingBlock, CourtColumn, UpdateBookingData }

// ── MAIN GRID ─────────────────────────────────────────────────────────────

export default function BookingGrid({
  courts,
  bookings,
  date,
  clubId,
  gridStart,
  gridEnd,
  highlightBookingId,
}: BookingGridProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const scrolledHighlightRef = useRef<string | null>(null)
  const scrolledNowRef = useRef(false)
  const slotOpenNonceRef = useRef(0)
  const slotHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotHoverPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [colWidth, setColWidth] = useState(140)
  const [gridReady, setGridReady] = useState(false)
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  const [clientTodayStr, setClientTodayStr] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<BookingBlock | null>(null)
  const [highlightId, setHighlightId] = useState<string | undefined>(highlightBookingId)
  const [showNewBookingPopup, setShowNewBookingPopup] = useState(false)

  const [focusCourtId, setFocusCourtId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<SourceFilterKey>(null)

  const [tooltip, setTooltip] = useState<{
    booking: BookingBlock
    x: number
    y: number
  } | null>(null)
  const [slotTooltip, setSlotTooltip] = useState<{
    courtName: string
    time: string
    x: number
    y: number
  } | null>(null)

  const isViewingToday = clientTodayStr ? date === clientTodayStr : false
  const isViewingPast = clientTodayStr ? date < clientTodayStr : false

  const highlightedBooking = useMemo(
    () => (highlightId ? bookings.find((b) => b.id === highlightId) : undefined),
    [bookings, highlightId]
  )

  useEffect(() => { setHighlightId(highlightBookingId) }, [highlightBookingId])

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    if (!highlightId) { setShowNewBookingPopup(false); return }
    setShowNewBookingPopup(true)
    const timer = setTimeout(() => setShowNewBookingPopup(false), 5000)
    return () => clearTimeout(timer)
  }, [highlightId])

  useEffect(() => {
    function updateToday() { setClientTodayStr(getLocalDateStr()) }
    updateToday()
    const iv = setInterval(updateToday, 60_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    return () => { if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current) }
  }, [])

  const visibleCourts = useMemo(
    () => (focusCourtId ? courts.filter((c) => c.id === focusCourtId) : courts),
    [courts, focusCourtId]
  )

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (typeFilter === null) return true
        if (typeFilter === 'MANUAL') return b.source === 'MANUAL_OWNER' || b.source === 'MANUAL_SUPPORT'
        if (typeFilter === 'RECURRING') return !!b.recurringBookingId
        return b.source === typeFilter
      }),
    [bookings, typeFilter]
  )

  const visibleCourtCount = visibleCourts.length

  // ── Drag / resize ────────────────────────────────────────────────────

  const {
    draggingId,
    resizingId,
    ghostPos,
    resizeHeightPx,
    localOverrides,
    handleDragStart,
    handleResizeStart,
  } = useBookingDragResize({
    clubId: clubId ?? bookings[0]?.clubId ?? '',
    gridStart,
    gridEnd,
    visibleCourts,
    colWidth,
    containerRef,
    gridBodyRef,
  })

  // Apply local overrides for optimistic drag/resize rendering
  const effectiveBookings = useMemo(() => {
    const keys = Object.keys(localOverrides)
    if (keys.length === 0) return visibleBookings
    return visibleBookings.map((b) => {
      const ov = localOverrides[b.id]
      return ov ? { ...b, startTime: ov.startTime, durationMinutes: ov.durationMinutes, courtId: ov.courtId } : b
    })
  }, [visibleBookings, localOverrides])

  const bookingsByCourt = useMemo(() => {
    const map = new Map<string, BookingBlock[]>()
    for (const booking of effectiveBookings) {
      const current = map.get(booking.courtId)
      if (current) current.push(booking)
      else map.set(booking.courtId, [booking])
    }
    return map
  }, [effectiveBookings])

  const occupiedSlotsByCourt = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const booking of effectiveBookings) {
      const bookingStart = timeToMinutes(booking.startTime)
      const bookingEnd = bookingStart + booking.durationMinutes
      let slots = map.get(booking.courtId)
      if (!slots) { slots = new Set<number>(); map.set(booking.courtId, slots) }
      for (let slotMin = bookingStart; slotMin < bookingEnd; slotMin += 30) {
        slots.add(slotMin)
      }
    }
    return map
  }, [effectiveBookings])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const totalWidth = entry.contentRect.width - TIME_COL_WIDTH
        const w = Math.max(100, Math.floor(totalWidth / Math.max(visibleCourtCount, 1)))
        setColWidth(w)
        setGridReady(true)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [visibleCourtCount])

  useEffect(() => {
    if (!isViewingToday) { setCurrentMinutes(null); return }
    function update() {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }
    update()
    const iv = setInterval(update, 60_000)
    return () => clearInterval(iv)
  }, [isViewingToday])

  useEffect(() => {
    if (!highlightId || !containerRef.current || !highlightedBooking) return
    if (scrolledHighlightRef.current === highlightId) return
    const targetMin = timeToMinutes(highlightedBooking.startTime)
    if (targetMin < gridStart || targetMin > gridEnd) return
    const top = ((targetMin - gridStart) / 30) * SLOT_HEIGHT
    containerRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
    scrolledHighlightRef.current = highlightId
  }, [highlightId, highlightedBooking, gridStart, gridEnd])

  useEffect(() => { scrolledNowRef.current = false }, [date])

  useEffect(() => {
    if (highlightId || !isViewingToday || scrolledNowRef.current || !containerRef.current) return
    const now = new Date()
    const targetMin = now.getHours() * 60 + now.getMinutes()
    if (targetMin < gridStart || targetMin > gridEnd) return
    const top = ((targetMin - gridStart) / 30) * SLOT_HEIGHT
    containerRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
    scrolledNowRef.current = true
  }, [highlightId, isViewingToday, gridStart, gridEnd, date])

  const totalSlots = (gridEnd - gridStart) / 30
  const gridHeight = totalSlots * SLOT_HEIGHT

  const currentLineTop =
    currentMinutes !== null && currentMinutes >= gridStart && currentMinutes <= gridEnd
      ? ((currentMinutes - gridStart) / 30) * SLOT_HEIGHT
      : null

  function handleEmptyClick(courtId: string, slotMinutes: number) {
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    setSlotTooltip(null)
    const timeStr = minutesToTime(slotMinutes)
    const dateParam = encodeURIComponent(date)
    slotOpenNonceRef.current += 1
    const nonce = slotOpenNonceRef.current
    router.push(
      `/admin/reservas/nueva?courtId=${courtId}&date=${dateParam}&time=${timeStr}&view=day&n=${nonce}`
    )
  }

  function handleSlotMouseEnter(courtName: string, slotMinutes: number, x: number, y: number) {
    if (draggingId) return
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    slotHoverPointerRef.current = { x, y }
    const time = minutesToTime(slotMinutes)
    slotHoverTimerRef.current = setTimeout(() => {
      const pos = clampTooltipPosition(slotHoverPointerRef.current.x, slotHoverPointerRef.current.y, 170, 62)
      setSlotTooltip({ courtName, time, x: pos.x, y: pos.y })
    }, TOOLTIP_DELAY_MS)
  }

  function handleSlotMouseMove(x: number, y: number) {
    if (draggingId) return
    slotHoverPointerRef.current = { x, y }
    setSlotTooltip((prev) => {
      if (!prev) return prev
      const pos = clampTooltipPosition(x, y, 170, 62)
      if (!shouldUpdateTooltipPosition(prev.x, prev.y, pos.x, pos.y)) return prev
      return { ...prev, x: pos.x, y: pos.y }
    })
  }

  function handleSlotMouseLeave() {
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    setSlotTooltip(null)
  }

  // ── Ghost block class (same visual style as source booking) ──────────
  const ghostBooking = ghostPos
    ? effectiveBookings.find((b) => b.id === draggingId)
    : null
  const ghostBlockCls = ghostBooking
    ? getBlockClass(ghostBooking.source, ghostBooking.status, ghostBooking.recurringBookingId)
    : 'booking-block-manual'

  return (
    <>
      {gridReady && (
        <BookingGridFilterBar
          courts={courts}
          focusCourtId={focusCourtId}
          typeFilter={typeFilter}
          bookingCount={bookings.filter((b) => b.status !== 'CANCELLED').length}
          onFocusCourtChange={setFocusCourtId}
          onTypeFilterChange={setTypeFilter}
        />
      )}

      <div ref={containerRef} className="grow overflow-auto min-h-0">
        {!gridReady ? (
          <BookingGridSkeleton courts={visibleCourts} gridStart={gridStart} gridEnd={gridEnd} />
        ) : (
        <div style={{ minWidth: `${TIME_COL_WIDTH + visibleCourts.length * 100}px` }}>
          <BookingGridHeader visibleCourts={visibleCourts} colWidth={colWidth} />

          <div ref={gridBodyRef} className="relative flex">
            <BookingGridTimeColumn
              gridStart={gridStart}
              gridEnd={gridEnd}
              currentMinutes={currentMinutes}
              isViewingPast={isViewingPast}
            />

            {visibleCourts.map((court) => {
              const courtBookings = bookingsByCourt.get(court.id) ?? []
              const occupiedSlots = occupiedSlotsByCourt.get(court.id)

              return (
                <div
                  key={court.id}
                  style={{ width: colWidth, minWidth: colWidth, height: gridHeight }}
                  className="relative border-l border-border"
                >
                  {!court.isActive && <div className="court-reform-overlay" />}

                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const isHour = slotMin % 60 === 0
                    const hasBookingAtSlot = occupiedSlots?.has(slotMin) ?? false
                    const isPast =
                      !court.isActive ||
                      isViewingPast ||
                      (currentMinutes !== null && slotMin < currentMinutes) ||
                      hasBookingAtSlot
                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 transition-colors
                                    ${isHour ? 'bg-(--grid-row-alt)' : ''}
                                    ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}
                                    ${isPast ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'group cursor-pointer'}`}
                        style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        onMouseEnter={(e) =>
                          !isPast && handleSlotMouseEnter(court.name, slotMin, e.clientX, e.clientY)
                        }
                        onMouseMove={(e) => !isPast && handleSlotMouseMove(e.clientX, e.clientY)}
                        onMouseLeave={handleSlotMouseLeave}
                        onClick={() => !isPast && handleEmptyClick(court.id, slotMin)}
                      >
                        {!isPast && (
                          <span className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-150 bg-(--grid-slot-hover) group-hover:opacity-100" />
                        )}
                      </div>
                    )
                  })}

                  {courtBookings.map((b) => (
                    <BookingBlockCell
                      key={b.id}
                      booking={b}
                      gridStart={gridStart}
                      gridHeight={gridHeight}
                      isHighlighted={highlightId === b.id}
                      isDragging={draggingId === b.id}
                      isResizing={resizingId === b.id}
                      heightOverride={resizingId === b.id ? (resizeHeightPx ?? undefined) : undefined}
                      onDragStart={handleDragStart}
                      onResizeStart={handleResizeStart}
                      onSelect={() => setSelectedBooking(b)}
                      onTooltipEnter={(x, y) => {
                        if (draggingId) return
                        const pos = clampTooltipPosition(x, y, 220, 96)
                        setTooltip({ booking: b, x: pos.x, y: pos.y })
                      }}
                      onTooltipMove={(x, y) =>
                        setTooltip((prev) => {
                          if (!prev || draggingId) return null
                          const pos = clampTooltipPosition(x, y, 220, 96)
                          if (!shouldUpdateTooltipPosition(prev.x, prev.y, pos.x, pos.y)) return prev
                          return { ...prev, x: pos.x, y: pos.y }
                        })
                      }
                      onTooltipLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              )
            })}

            {/* Drag ghost — floats at snapped target position */}
            {ghostPos && draggingId && (
              <div
                className={`booking-block ${ghostBlockCls} pointer-events-none opacity-60 border-2 border-dashed`}
                style={{
                  position: 'absolute',
                  top: ((ghostPos.startMin - gridStart) / 30) * SLOT_HEIGHT + 2,
                  left: TIME_COL_WIDTH + ghostPos.courtIndex * colWidth + 5,
                  width: colWidth - 10,
                  height: Math.max((ghostPos.durationMinutes / 30) * SLOT_HEIGHT - 3, 22),
                  zIndex: 40,
                }}
              />
            )}

            {currentLineTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentLineTop }}
              >
                <div className="flex items-center">
                  <div
                    style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
                    className="shrink-0 flex items-center justify-end pr-0.5"
                  >
                    <div className="w-2.5 h-2.5 rounded-full now-dot" style={{ background: 'var(--now-line)' }} />
                  </div>
                  <div className="flex-1 h-px opacity-70" style={{ background: 'var(--now-line)' }} />
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {gridReady && selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      {gridReady && (
        <BookingGridTooltips
          tooltip={tooltip}
          slotTooltip={slotTooltip}
          selectedBooking={selectedBooking}
          showNewBookingPopup={showNewBookingPopup}
          highlightedBooking={highlightedBooking}
        />
      )}
    </>
  )
}
