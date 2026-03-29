'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BookingDetailModal from './BookingDetailModal/BookingDetailModal'
import BookingQuickPopover from './BookingQuickPopover/BookingQuickPopover'
import BookingGridFilterBar from './BookingGridFilterBar/BookingGridFilterBar'
import BookingGridHeader from './BookingGridHeader/BookingGridHeader'
import BookingGridTimeColumn from './BookingGridTimeColumn/BookingGridTimeColumn'
import BookingBlockCell from './BookingBlockCell/BookingBlockCell'
import BookingGridTooltips from './BookingGridTooltips/BookingGridTooltips'
import BookingGridSkeleton from './BookingGridSkeleton/BookingGridSkeleton'
import { useBookingDragResize } from './hooks/useBookingDragResize'
import { useBookingDragCreate } from './hooks/useBookingDragCreate'
import DragCreatePopover from './DragCreatePopover/DragCreatePopover'
import type {
  BookingBlock,
  BookingGridProps,
  CourtColumn,
  UpdateBookingData,
} from './types/bookingGrid.types'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { createManualBooking } from '@/features/reservas/actions/bookings'
import { BLOCK_SOURCES } from '@/features/reservas/constants/bookingSources'
import {
  SLOT_HEIGHT,
  TIME_COL_WIDTH,
  TOOLTIP_DELAY_MS,
  clampTooltipPosition,
  getBlockClass,
  getLocalDateStr,
  isBlockSource,
  shouldUpdateTooltipPosition,
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
  isNavigating,
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
  const [quickPopover, setQuickPopover] = useState<{
    booking: BookingBlock
    courtName: string
    x: number
    y: number
  } | null>(null)
  const [highlightId, setHighlightId] = useState<string | undefined>(highlightBookingId)

  const [focusCourtIds, setFocusCourtIds] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<SourceFilterKey>(null)
  const [paymentFilter, setPaymentFilter] = useState<'PAID' | 'UNPAID' | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)

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
    function updateToday() { setClientTodayStr(getLocalDateStr()) }
    updateToday()
    const iv = setInterval(updateToday, 60_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    return () => { if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current) }
  }, [])

  const visibleCourts = useMemo(
    () => (focusCourtIds.length > 0 ? courts.filter((c) => focusCourtIds.includes(c.id)) : courts),
    [courts, focusCourtIds]
  )

  function toggleCourtFilter(id: string) {
    setFocusCourtIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (typeFilter !== null) {
          if (typeFilter === 'MANUAL' && b.source !== 'MANUAL_OWNER' && b.source !== 'MANUAL_SUPPORT') return false
          else if (typeFilter === 'RECURRING' && !b.recurringBookingId) return false
          else if (typeFilter !== 'MANUAL' && typeFilter !== 'RECURRING' && b.source !== typeFilter) return false
        }
        if (paymentFilter !== null) {
          if (isBlockSource(b.source) || b.status === 'CANCELLED') return false
          if (paymentFilter === 'PAID' && b.paymentStatus !== 'PAID') return false
          if (paymentFilter === 'UNPAID' && (b.paymentStatus === 'PAID' || b.paymentStatus === 'MANUAL')) return false
        }
        return true
      }),
    [bookings, typeFilter, paymentFilter]
  )


  const unpaidCount = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status !== 'CANCELLED' &&
          !BLOCK_SOURCES.has(b.source) &&
          b.paymentStatus !== 'PAID' &&
          b.paymentStatus !== 'MANUAL'
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings]
  )

  const visibleCourtCount = visibleCourts.length

  // ── Drag / resize ────────────────────────────────────────────────────

  const resolvedClubId = clubId ?? bookings[0]?.clubId ?? ''

  const {
    draggingId,
    resizingId,
    ghostPos,
    resizeHeightPx,
    localOverrides,
    handleDragStart,
    handleResizeStart,
  } = useBookingDragResize({
    clubId: resolvedClubId,
    gridStart,
    gridEnd,
    visibleCourts,
    colWidth,
    containerRef,
    gridBodyRef,
  })

  // ── Drag-to-create ───────────────────────────────────────────────────

  const {
    createGhost,
    pendingCreate,
    handleCreateStart,
    handleCancelCreate,
  } = useBookingDragCreate({
    gridStart,
    gridEnd,
    visibleCourts,
    colWidth,
    containerRef,
    gridBodyRef,
    onEmptyClick: handleEmptyClick,
  })

  function handleDragCreated(bookingId: string | undefined) {
    handleCancelCreate()
    window.dispatchEvent(new CustomEvent('reservas:refresh', { detail: { bookingId } }))
  }

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
        const w = Math.max(160, Math.floor(totalWidth / Math.max(visibleCourtCount, 1)))
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

  const scrollToNow = useCallback(() => {
    if (!containerRef.current) return
    const now = new Date()
    const targetMin = now.getHours() * 60 + now.getMinutes()
    if (targetMin < gridStart || targetMin > gridEnd) return
    const top = ((targetMin - gridStart) / 30) * SLOT_HEIGHT
    containerRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
  }, [gridStart, gridEnd])

  const scrollToNextFree = useCallback(() => {
    if (!containerRef.current) return
    const now = new Date()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    const startMin = Math.ceil(currentMin / 30) * 30
    for (let slotMin = startMin; slotMin <= gridEnd - 30; slotMin += 30) {
      const hasFree = visibleCourts.some((court) => {
        if (!court.isActive) return false
        return !occupiedSlotsByCourt.get(court.id)?.has(slotMin)
      })
      if (hasFree) {
        const top = ((slotMin - gridStart) / 30) * SLOT_HEIGHT
        containerRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
        return
      }
    }
  }, [visibleCourts, occupiedSlotsByCourt, gridStart, gridEnd])

  useEffect(() => {
    if (highlightId || !isViewingToday || scrolledNowRef.current || !gridReady) return
    requestAnimationFrame(() => {
      scrollToNow()
      scrolledNowRef.current = true
    })
  }, [highlightId, isViewingToday, gridStart, gridEnd, date, gridReady, scrollToNow])

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
      <BookingGridFilterBar
        courts={courts}
        focusCourtIds={focusCourtIds}
        typeFilter={typeFilter}
        paymentFilter={paymentFilter}
        unpaidCount={unpaidCount}
        onCourtToggle={toggleCourtFilter}
        onClearCourts={() => setFocusCourtIds([])}
        onTypeFilterChange={setTypeFilter}
        onPaymentFilterChange={setPaymentFilter}
      />

      <div className="grow min-h-0 relative overflow-hidden">
        {isNavigating && (
          <div className="absolute inset-0 z-[25] bg-bg/60 backdrop-blur-[2px] flex items-center justify-center animate-fadeIn">
            <div className="w-9 h-9 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        )}
      <div ref={containerRef} className="h-full overflow-auto">
        {!gridReady ? (
          <BookingGridSkeleton courts={visibleCourts} gridStart={gridStart} gridEnd={gridEnd} />
        ) : (
        <div style={{ minWidth: `${TIME_COL_WIDTH + visibleCourts.length * 160}px` }}>
          <BookingGridHeader courts={courts} visibleCourts={visibleCourts} colWidth={colWidth} />

          <div ref={gridBodyRef} className="relative flex">
            <BookingGridTimeColumn
              gridStart={gridStart}
              gridEnd={gridEnd}
              currentMinutes={currentMinutes}
              isViewingPast={isViewingPast}
            />

            {visibleCourts.map((court, courtIndex) => {
              const courtBookings = bookingsByCourt.get(court.id) ?? []
              const occupiedSlots = occupiedSlotsByCourt.get(court.id)

              return (
                <div
                  key={court.id}
                  style={{ width: colWidth, minWidth: colWidth, height: gridHeight, background: courtIndex % 2 === 1 ? 'var(--grid-col-alt)' : undefined }}
                  className="relative border-l border-border"
                >
                  {!court.isActive && <div className="court-reform-overlay" />}

                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const isHour = slotMin % 60 === 0
                    const hasBookingAtSlot = occupiedSlots?.has(slotMin) ?? false
                    const courtCloseMin = court.closeTimeMinutes ?? gridEnd
                    const courtOpenMin = court.openTimeMinutes ?? gridStart
                    const isPast =
                      !court.isActive ||
                      isViewingPast ||
                      (currentMinutes !== null && slotMin < currentMinutes) ||
                      hasBookingAtSlot ||
                      slotMin < courtOpenMin ||
                      slotMin + 60 > courtCloseMin
                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 transition-colors
                                    ${isHour ? 'bg-(--grid-row-alt)' : ''}
                                    ${isHour ? 'border-b border-zinc-800/60' : 'border-b border-zinc-800/25'}
                                    ${isPast ? 'opacity-40 cursor-not-allowed pointer-events-none' : draggingId ? 'pointer-events-none' : 'group cursor-pointer'}`}
                        style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        onMouseEnter={(e) =>
                          !isPast && handleSlotMouseEnter(court.name, slotMin, e.clientX, e.clientY)
                        }
                        onMouseMove={(e) => !isPast && handleSlotMouseMove(e.clientX, e.clientY)}
                        onMouseLeave={handleSlotMouseLeave}
                        onPointerDown={(e) => !isPast && !draggingId && handleCreateStart(court.id, courtIndex, slotMin, e)}
                      >
                        {!isPast && (
                          <span className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-150 bg-(--grid-slot-hover) group-hover:opacity-100" />
                        )}
                      </div>
                    )
                  })}

                  {courtBookings.map((b) => {
                    const bookingEndMin = timeToMinutes(b.startTime) + b.durationMinutes
                    const isBookingPast = isViewingPast || (isViewingToday && currentMinutes !== null && bookingEndMin <= currentMinutes)
                    return (
                    <BookingBlockCell
                      key={b.id}
                      booking={b}
                      gridStart={gridStart}
                      gridHeight={gridHeight}
                      isHighlighted={highlightId === b.id}
                      isDragging={draggingId === b.id}
                      isResizing={resizingId === b.id}
                      heightOverride={resizingId === b.id ? (resizeHeightPx ?? undefined) : undefined}
                      isPast={isBookingPast}
                      onDragStart={handleDragStart}
                      onResizeStart={handleResizeStart}
                      onSelect={(x, y) => setQuickPopover({ booking: b, courtName: court.name, x, y })}
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
                  )
                  })}
                </div>
              )
            })}

            {/* Drag ghost — muestra el contenido real de la reserva */}
            {ghostPos && draggingId && ghostBooking && (() => {
              const ghostEndTime = minutesToTime(ghostPos.startMin + ghostPos.durationMinutes)
              const ghostStartTime = minutesToTime(ghostPos.startMin)
              const ghostHeight = Math.max((ghostPos.durationMinutes / 30) * SLOT_HEIGHT - 3, 22)
              const isPaid = ghostBooking.paymentStatus === 'PAID'
              const isManualPaid = ghostBooking.paymentStatus === 'MANUAL'
              const isUnpaid = !isPaid && !isManualPaid && !isBlockSource(ghostBooking.source)
              return (
                <div
                  className={`booking-block ${ghostBlockCls} pointer-events-none opacity-70 border-2 border-dashed`}
                  style={{
                    position: 'absolute',
                    top: ((ghostPos.startMin - gridStart) / 30) * SLOT_HEIGHT + 2,
                    left: TIME_COL_WIDTH + ghostPos.courtIndex * colWidth + 5,
                    width: colWidth - 10,
                    height: ghostHeight,
                    zIndex: 40,
                  }}
                >
                  <p className="text-[11px] font-bold leading-tight truncate">{ghostBooking.displayName}</p>
                  {ghostHeight > 34 && (
                    <p className="text-[9px] font-mono leading-tight opacity-70">
                      {ghostStartTime} – {ghostEndTime}
                    </p>
                  )}
                  {ghostHeight > 52 && !isBlockSource(ghostBooking.source) && (
                    <p className={`text-[10px] font-semibold mt-auto truncate ${isUnpaid ? 'text-red-400' : 'opacity-75'}`}>
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(ghostBooking.totalPrice / 100)}
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Drag-create ghost */}
            {createGhost && (
              <div
                className={`booking-block-create-preview absolute${pendingCreate ? ' is-pending' : ''}`}
                style={{
                  top: ((createGhost.startMin - gridStart) / 30) * SLOT_HEIGHT + 2,
                  left: TIME_COL_WIDTH + createGhost.courtIndex * colWidth + 5,
                  width: colWidth - 10,
                  height: Math.max((createGhost.durationMinutes / 30) * SLOT_HEIGHT - 3, 22),
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <p className="text-[11px] font-bold leading-tight">Nueva reserva</p>
                <p className="text-[10px] font-mono leading-tight opacity-70">
                  {minutesToTime(createGhost.startMin)} – {minutesToTime(createGhost.startMin + createGhost.durationMinutes)}
                </p>
              </div>
            )}

            {currentLineTop !== null && currentMinutes !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentLineTop }}
              >
                <div className="flex items-center">
                  <div
                    style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
                    className="shrink-0 flex items-center justify-end pr-1 relative"
                  >
                    {/* hora actual sobre la columna de tiempo */}
                    <span
                      className="absolute right-full mr-0.5 text-[9px] font-bold tabular-nums leading-none"
                      style={{ color: 'var(--now-line)', transform: 'translateY(-50%)' }}
                    >
                      {String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:{String(currentMinutes % 60).padStart(2, '0')}
                    </span>
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: 'var(--now-line)', boxShadow: '0 0 10px 3px rgba(217,249,36,0.55)' }}
                    />
                  </div>
                  <div
                    className="flex-1"
                    style={{ height: '1.5px', background: 'var(--now-line)', boxShadow: '0 0 5px rgba(217,249,36,0.35)' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      </div>

      {gridReady && isViewingToday && currentLineTop !== null && (() => {
        const currentSlotMin = currentMinutes !== null ? Math.floor(currentMinutes / 30) * 30 : null
        const hasFreeCourt = currentSlotMin !== null && visibleCourts.some((court) => {
          if (!court.isActive) return false
          return !occupiedSlotsByCourt.get(court.id)?.has(currentSlotMin)
        })
        return (
          <button
            onClick={hasFreeCourt ? scrollToNow : scrollToNextFree}
            title={hasFreeCourt ? 'Ir al timeline' : 'Ir al próximo slot libre'}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 border border-border text-[11px] text-sub hover:text-text hover:border-accent/40 transition-colors shadow-md backdrop-blur-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--now-line)] opacity-80" />
            {hasFreeCourt ? 'Ahora' : 'Próximo libre'}
          </button>
        )
      })()}

      {gridReady && quickPopover && (
        <BookingQuickPopover
          booking={quickPopover.booking}
          courtName={quickPopover.courtName}
          anchorX={quickPopover.x}
          anchorY={quickPopover.y}
          onClose={() => setQuickPopover(null)}
          onOpenDetail={() => {
            setOpenInEditMode(false)
            setSelectedBooking(quickPopover.booking)
            setQuickPopover(null)
          }}
          onOpenEdit={() => {
            setOpenInEditMode(true)
            setSelectedBooking(quickPopover.booking)
            setQuickPopover(null)
          }}
        />
      )}

      {gridReady && selectedBooking && (
        <BookingDetailModal
          key={`${selectedBooking.id}-${openInEditMode}`}
          booking={selectedBooking}
          onClose={() => { setSelectedBooking(null); setOpenInEditMode(false) }}
          closeTimeMinutes={courts.find(c => c.id === selectedBooking.courtId)?.closeTimeMinutes}
          openTimeMinutes={courts.find(c => c.id === selectedBooking.courtId)?.openTimeMinutes}
          defaultEditing={openInEditMode}
        />
      )}

      {gridReady && (
        <BookingGridTooltips
          tooltip={tooltip}
          slotTooltip={slotTooltip}
          selectedBooking={selectedBooking}
        />
      )}

      {pendingCreate && (
        <DragCreatePopover
          pendingCreate={pendingCreate}
          clubId={resolvedClubId}
          date={date}
          courts={courts}
          createManualBookingAction={createManualBooking}
          onCancel={handleCancelCreate}
          onCreated={handleDragCreated}
        />
      )}
    </>
  )
}
