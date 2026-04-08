'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Wrench } from 'lucide-react'
import BookingDetailDrawer from './BookingDetailDrawer/BookingDetailDrawer'
import BookingQuickPopover from './BookingQuickPopover/BookingQuickPopover'
import BookingGridFilterBar from './BookingGridFilterBar/BookingGridFilterBar'
import BookingGridHeader from './BookingGridHeader/BookingGridHeader'
import BookingGridTimeColumn from './BookingGridTimeColumn/BookingGridTimeColumn'
import BookingBlockCell from './BookingBlockCell/BookingBlockCell'
import BookingGridSkeleton from './BookingGridSkeleton/BookingGridSkeleton'
import { useBookingDragResize } from './hooks/useBookingDragResize'
import { useBookingDragCreate } from './hooks/useBookingDragCreate'
import type {
  BookingBlock,
  BookingGridProps,
  CourtColumn,
  UpdateBookingData,
} from './types/bookingGrid.types'
import { minutesToTime, timeToMinutes } from '@/lib/availability'
import { BLOCK_SOURCES } from '@/features/reservas/constants/bookingSources'
import {
  SLOT_HEIGHT,
  COMPACT_SLOT_HEIGHT,
  TIME_COL_WIDTH,
  getBlockClass,
  getLocalDateStr,
  isBlockSource,
  type SourceFilterKey,
} from './helpers/bookingGrid.helpers'
import { toast } from 'sonner'

export type { BookingBlock, CourtColumn, UpdateBookingData }

// ── MAIN GRID ─────────────────────────────────────────────────────────────

export default function BookingGrid({
  courts,
  bookings,
  date,
  clubId,
  gridStart,
  gridEnd,
  baseStart,
  baseEnd,
  conflictIds,
  show24Hours = false,
  onToggle24Hours,
  hasHiddenBookings = false,
  todayConflictCount = 0,
  totalConflictCount = 0,
  highlightBookingId,
  onCellClick,
  onDragCreateReady,
  isFormOpen = false,
  activeDraft,
  focusCourtIds: focusCourtIdsProp,
  onCourtToggle,
  onClearCourts,
}: BookingGridProps) {
  const [compactMode, setCompactMode] = useState(false)
  const slotHeight = compactMode ? COMPACT_SLOT_HEIGHT : SLOT_HEIGHT

  const containerRef = useRef<HTMLDivElement>(null)
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const scrolledHighlightRef = useRef<string | null>(null)
  const scrolledNowRef = useRef(false)
  // Scroll preservation across gridStart/gridEnd changes (24h toggle)
  const prevGridStartRef = useRef(gridStart)
  const scrollAnchorRef = useRef<{ topMinutes: number } | null>(null)
  if (prevGridStartRef.current !== gridStart) {
    if (containerRef.current && scrollAnchorRef.current === null) {
      const minutesFromStart = (containerRef.current.scrollTop / slotHeight) * 30
      scrollAnchorRef.current = { topMinutes: prevGridStartRef.current + minutesFromStart }
    }
    prevGridStartRef.current = gridStart
  }
  const clickedCellRectRef = useRef<DOMRect | null>(null)
  const onDragCreateReadyRef = useRef(onDragCreateReady)
  onDragCreateReadyRef.current = onDragCreateReady
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


  // focusCourtIds: controlled from BookingsClient (lifted) so sidebar can also toggle courts
  const [localFocusCourtIds, setLocalFocusCourtIds] = useState<string[]>([])
  const focusCourtIds = focusCourtIdsProp ?? localFocusCourtIds
  const toggleCourtFilter = onCourtToggle ?? ((id: string) => setLocalFocusCourtIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const clearCourts = onClearCourts ?? (() => setLocalFocusCourtIds([]))
  const [typeFilter, setTypeFilter] = useState<SourceFilterKey>(null)
  const [paymentFilter, setPaymentFilter] = useState<'PAID' | 'UNPAID' | null>(null)


  const isViewingToday = clientTodayStr ? date === clientTodayStr : false
  const isViewingPast = clientTodayStr ? date < clientTodayStr : false

  const highlightedBooking = useMemo(
    () => (highlightId ? bookings.find((b) => b.id === highlightId) : undefined),
    [bookings, highlightId]
  )

  // Si la prop de arriba cambia, forzamos la actualización sin useEffect (React pro-tip)
  const prevHighlightPropRef = useRef(highlightBookingId)
  if (highlightBookingId !== prevHighlightPropRef.current) {
    prevHighlightPropRef.current = highlightBookingId
    setHighlightId(highlightBookingId)
  }

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(undefined), 30_000)
    return () => clearTimeout(timer)
  }, [highlightId])

  const visibleCourts = useMemo(
    () => (focusCourtIds.length > 0 ? courts.filter((c) => focusCourtIds.includes(c.id)) : courts),
    [courts, focusCourtIds]
  )

  const visibleCourtCount = visibleCourts.length

  // ── Drag / resize ────────────────────────────────────────────────────

  const courtMinDurations = useMemo(() => {
      const map = new Map<string, number>()
      for (const court of visibleCourts) {
        // La grilla visual ya no maneja las reglas complejas de duración.
        // Seteamos 60 min (o 90) solo como tamaño del bloque fantasma al hacer clic.
        // El Popover se encargará de ajustarlo a la duración real permitida.
        map.set(court.id, 60) 
      }
      return map
    }, [visibleCourts])

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
    slotHeight,
    containerRef,
    gridBodyRef,
  })

  // ── Drag-to-create ───────────────────────────────────────────────────
const { effectiveBookings, occupiedSlotsByCourt, bookingsByCourt, unpaidCount } = useMemo(() => {
    const effective: BookingBlock[] = []
    const occupied = new Map<string, Set<number>>()
    const byCourt = new Map<string, BookingBlock[]>()
    let unpaid = 0

    for (const b of bookings) {
      // 1. Cálculo de Deuda (Unpaid) - Filtro global
      const isCancelled = b.status === 'CANCELLED'
      const isBlock = BLOCK_SOURCES.has(b.source)
      if (!isCancelled && !isBlock && b.paymentStatus !== 'PAID' && b.paymentStatus !== 'MANUAL') {
        unpaid++
      }

      // 2. Filtros de Visibilidad (UI Filters)
      if (typeFilter !== null) {
        if (typeFilter === 'MANUAL' && b.source !== 'MANUAL_STAFF' && b.source !== 'MANUAL_SUPPORT') continue
        if (typeFilter === 'RECURRING' && !b.recurringBookingId) continue
        if (typeFilter !== 'MANUAL' && typeFilter !== 'RECURRING' && b.source !== typeFilter) continue
      }
      if (paymentFilter !== null) {
        if (isBlock || isCancelled) continue
        if (paymentFilter === 'PAID' && b.paymentStatus !== 'PAID') continue
        if (paymentFilter === 'UNPAID' && (b.paymentStatus === 'PAID' || b.paymentStatus === 'MANUAL')) continue
      }

      // 3. Aplicar Drag & Drop Overrides
      const ov = localOverrides[b.id]
      const effectiveB = ov 
        ? { ...b, startTime: ov.startTime, durationMinutes: ov.durationMinutes, courtId: ov.courtId } 
        : b

      effective.push(effectiveB)

      // 4. Agrupar por Cancha
      const list = byCourt.get(effectiveB.courtId) ?? []
      list.push(effectiveB)
      byCourt.set(effectiveB.courtId, list)

      // 5. Calcular Ocupación
      const startMin = timeToMinutes(effectiveB.startTime)
      const endMin = startMin + effectiveB.durationMinutes
      let slots = occupied.get(effectiveB.courtId)
      if (!slots) { slots = new Set<number>(); occupied.set(effectiveB.courtId, slots) }
      for (let m = startMin; m < endMin; m += 30) slots.add(m)
    }

    return { effectiveBookings: effective, occupiedSlotsByCourt: occupied, bookingsByCourt: byCourt, unpaidCount: unpaid }
  }, [bookings, typeFilter, paymentFilter, localOverrides])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const totalWidth = entry.contentRect.width - TIME_COL_WIDTH
        const natural = Math.floor(totalWidth / Math.max(visibleCourtCount, 1))
        // No upper cap — courts fill all available horizontal space.
        // Lower cap 120px ensures the grid stays scrollable when many courts are visible.
        const w = Math.max(120, natural)
        setColWidth(w)
        setGridReady(true)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [visibleCourtCount])

  const handleEmptyClick = useCallback((courtId: string, slotMinutes: number) => {
    const occupied = occupiedSlotsByCourt.get(courtId)
    const courtMinDuration = 60
    // Use gridEnd as the cap so slots after court hours can still be booked by admins
    let availableMinutes = gridEnd - slotMinutes
    if (occupied) {
      for (let m = slotMinutes + 30; m < gridEnd; m += 30) {
        if (occupied.has(m)) { availableMinutes = m - slotMinutes; break }
      }
    }
    if (availableMinutes < courtMinDuration) {
      toast.warning(`Espacio insuficiente. El mínimo para esta cancha es de ${courtMinDuration} minutos.`)
      clickedCellRectRef.current = null
      return
    }
    onCellClick?.(courtId, slotMinutes, clickedCellRectRef.current ?? undefined, availableMinutes)
    clickedCellRectRef.current = null
  }, [gridEnd, occupiedSlotsByCourt, onCellClick])


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
    slotHeight,
    containerRef,
    gridBodyRef,
    onEmptyClick: handleEmptyClick,
    occupiedSlots: occupiedSlotsByCourt,
    courtMinDurations,
  })
  const handleCellPointerDown = useCallback((courtId: string, courtIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingId || isFormOpen) return

    // Obtenemos el rectángulo de la COLUMNA
    const rect = e.currentTarget.getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    
    // Calculamos el slot exacto basado en la posición Y
    const slotIndex = Math.floor(relativeY / slotHeight)
    const slotMinutes = gridStart + (slotIndex * 30)

    // Seteamos la ref del rect para el formulario flotante (usando la posición de la celda calculada)
    clickedCellRectRef.current = {
      left: rect.left,
      top: rect.top + (slotIndex * slotHeight),
      width: rect.width,
      height: slotHeight,
    } as DOMRect

    // Iniciamos el drag-to-create
    handleCreateStart(courtId, courtIndex, slotMinutes, e)
  }, [draggingId, isFormOpen, gridStart, handleCreateStart])

// Calculamos la fecha actual una sola vez al montar (Hydration safe)
  useEffect(() => {
    setClientTodayStr(getLocalDateStr())
  }, [])

  // Un solo timer para mover la línea roja de la hora actual
  useEffect(() => {
    if (!isViewingToday) { 
      setCurrentMinutes(null)
      return 
    }
    function update() {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }
    update()
    const iv = setInterval(update, 60_000) // Se actualiza cada 1 minuto
    return () => clearInterval(iv)
  }, [isViewingToday])

// Notify parent when a drag-create finishes so FloatingBookingForm can open.
  // onDragCreateReady is accessed via ref so it never appears as a dep — only
  // pendingCreate (and the stable handleCancelCreate) gate this effect.
  useEffect(() => {
    if (!pendingCreate) return
    onDragCreateReadyRef.current?.(pendingCreate, handleCancelCreate, () => handleCancelCreate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate, handleCancelCreate])



  useEffect(() => {
    if (!highlightId || !containerRef.current || !highlightedBooking) return
    if (scrolledHighlightRef.current === highlightId) return
    const targetMin = timeToMinutes(highlightedBooking.startTime)
    if (targetMin < gridStart || targetMin > gridEnd) return
    const top = ((targetMin - gridStart) / 30) * slotHeight
    containerRef.current.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' })
    scrolledHighlightRef.current = highlightId
  }, [highlightId, highlightedBooking, gridStart, gridEnd])

  useEffect(() => { scrolledNowRef.current = false }, [date])

  // Restore scroll position after 24h toggle (E1.1)
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    const container = containerRef.current
    if (!anchor || !container) return
    scrollAnchorRef.current = null
    const newScrollTop = ((anchor.topMinutes - gridStart) / 30) * slotHeight
    container.scrollTop = Math.max(0, newScrollTop)
  }, [gridStart])

  const scrollToNow = useCallback(() => {
    if (!containerRef.current) return
    const now = new Date()
    const targetMin = now.getHours() * 60 + now.getMinutes()
    if (targetMin < gridStart || targetMin > gridEnd) return
    const top = ((targetMin - gridStart) / 30) * slotHeight
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
        const top = ((slotMin - gridStart) / 30) * slotHeight
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
  const gridHeight = totalSlots * slotHeight

  const currentLineTop =
    currentMinutes !== null && currentMinutes >= gridStart && currentMinutes <= gridEnd
      ? ((currentMinutes - gridStart) / 30) * slotHeight
      : null

  // ── Ghost block class (same visual style as source booking) ──────────
  const ghostBooking = ghostPos
    ? effectiveBookings.find((b) => b.id === draggingId)
    : null
  const ghostBlockCls = ghostBooking
    ? getBlockClass(ghostBooking.source, ghostBooking.status, ghostBooking.recurringBookingId)
    : 'booking-block-manual'

  return (
    <>
      {draggingId && <style>{`* { cursor: grabbing !important; } body { user-select: none; }`}</style>}
      {resizingId && <style>{`* { cursor: ns-resize !important; } body { user-select: none; }`}</style>}
      <BookingGridFilterBar
        typeFilter={typeFilter}
        paymentFilter={paymentFilter}
        onTypeFilterChange={setTypeFilter}
        onPaymentFilterChange={setPaymentFilter}
        show24Hours={show24Hours}
        onToggle24Hours={onToggle24Hours ?? (() => {})}
        hasHiddenBookings={hasHiddenBookings}
        todayConflictCount={todayConflictCount}
        totalConflictCount={totalConflictCount}
        compactMode={compactMode}
        onToggleCompact={() => setCompactMode((m) => !m)}
      />

      <div className="grow min-h-0 relative overflow-hidden">
      <div ref={containerRef} className="h-full overflow-auto">
        {!gridReady ? (
          <BookingGridSkeleton courts={visibleCourts} gridStart={gridStart} gridEnd={gridEnd} />
        ) : (
        <div style={{ minWidth: `${TIME_COL_WIDTH + visibleCourts.length * 120}px` }}>
          <BookingGridHeader courts={courts} visibleCourts={visibleCourts} colWidth={colWidth} />

          <div ref={gridBodyRef} className="relative flex">
            <BookingGridTimeColumn
              gridStart={gridStart}
              gridEnd={gridEnd}
              currentMinutes={currentMinutes}
              isViewingPast={isViewingPast}
              slotHeight={slotHeight}
            />

            {visibleCourts.map((court, courtIndex) => {
              const courtBookings = bookingsByCourt.get(court.id) ?? []
              const occupiedSlots = occupiedSlotsByCourt.get(court.id)

              return (
                <div
                  key={court.id}
                  style={{ width: colWidth, minWidth: colWidth, height: gridHeight, transition: 'height 300ms ease', background: courtIndex % 2 === 1 ? 'var(--grid-col-alt)' : undefined }}
                  className="relative border-l border-border"
                  onPointerDown={(e) => {
                    if (court.isUnderMaintenance || court.isActive === false) return
                    handleCellPointerDown(court.id, courtIndex, e)
                  }}
                >
                  {!court.isActive && <div className="court-reform-overlay" />}

                  {court.isUnderMaintenance ? (
                    <div className="absolute inset-0 pointer-events-none bg-red-950/40 border-x border-red-900/40">
                      <div className="sticky top-[45vh] -translate-y-1/2 flex flex-col items-center gap-2 py-3">
                        <Wrench className="w-7 h-7 text-red-500/50" strokeWidth={1.5} />
                        <span className="text-[9px] font-bold uppercase tracking-[2px] text-red-500/60">
                          Fuera de Servicio
                        </span>
                      </div>
                    </div>
                  ) : (
                  <>
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const isHour = slotMin % 60 === 0
                    const hasBookingAtSlot = occupiedSlots?.has(slotMin) ?? false
                    const isPast =
                      !court.isActive ||
                      isViewingPast ||
                      (currentMinutes !== null && slotMin < currentMinutes) ||
                      hasBookingAtSlot
                    const isOutOfBounds =
                      baseStart !== undefined && baseEnd !== undefined &&
                      (slotMin < baseStart || slotMin >= baseEnd)
                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 
                          ${isHour ? 'bg-(--grid-row-alt) border-b border-zinc-800/60' : 'border-b border-zinc-800/25'}
                          ${isPast ? 'opacity-40' : 'group'}`} // Usamos group para el hover CSS
                        style={{ top: i * slotHeight, height: slotHeight }}
                      >
                        {isOutOfBounds && <span className="absolute inset-0 bg-zinc-500/[0.11]" />}
                        
                        {!isPast && !isFormOpen && (
                          <>
                            <span className="absolute inset-0 opacity-0 transition-opacity duration-75 bg-(--grid-slot-hover) group-hover:opacity-20" />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none select-none">
                              <span className="text-[15px] font-thin leading-none" style={{ color: 'var(--muted)', opacity: 0.35 }}>+</span>
                            </span>
                          </>
                        )}
                      </div>
                      )
                    })}

                  {courtBookings.map((b) => {
                    const bookingStartMin = timeToMinutes(b.startTime)
                    const bookingEndMin = bookingStartMin + b.durationMinutes

                    // Skip bookings fully outside the visible grid
                    if (bookingStartMin >= gridEnd || bookingEndMin <= gridStart) return null

                    // Clamp visual height when booking overflows past gridEnd
                    const visibleEnd = Math.min(bookingEndMin, gridEnd)
                    const visibleDuration = visibleEnd - Math.max(bookingStartMin, gridStart)
                    const clampedHeight = bookingEndMin > gridEnd
                      ? Math.max((visibleDuration / 30) * slotHeight - 3, 22)
                      : undefined

                    const isBookingPast = isViewingPast || (isViewingToday && currentMinutes !== null && bookingEndMin <= currentMinutes)
                    return (
                    <BookingBlockCell
                      key={b.id}
                      booking={b}
                      gridStart={gridStart}
                      gridHeight={gridHeight}
                      isHighlighted={highlightId === b.id}
                      isConflict={conflictIds?.has(b.id) ?? false}
                      isDragging={draggingId === b.id}
                      isResizing={resizingId === b.id}
                      heightOverride={resizingId === b.id ? (resizeHeightPx ?? undefined) : clampedHeight}
                      isPast={isBookingPast}
                      slotHeight={slotHeight}
                      onDragStart={handleDragStart}
                      onResizeStart={handleResizeStart}
                      onSelect={(x, y) => setQuickPopover({ booking: b, courtName: court.name, x, y })}
                      isFormOpen={isFormOpen}
                    />
                  )
                  })}
                  </>
                  )}
                </div>
              )
            })}

            {/* Drag ghost — muestra el contenido real de la reserva */}
            {ghostPos && draggingId && ghostBooking && (() => {
              const ghostEndTime = minutesToTime(ghostPos.startMin + ghostPos.durationMinutes)
              const ghostStartTime = minutesToTime(ghostPos.startMin)
              const ghostHeight = Math.max((ghostPos.durationMinutes / 30) * slotHeight - 3, 22)
              const isPaid = ghostBooking.paymentStatus === 'PAID'
              const isManualPaid = ghostBooking.paymentStatus === 'MANUAL'
              const isUnpaid = !isPaid && !isManualPaid && !isBlockSource(ghostBooking.source)
              return (
                <div
                  className={`booking-block ${ghostBlockCls} pointer-events-none opacity-70 border-2 border-dashed`}
                  style={{
                    position: 'absolute',
                    top: ((ghostPos.startMin - gridStart) / 30) * slotHeight + 2,
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
                  top: ((createGhost.startMin - gridStart) / 30) * slotHeight + 2,
                  left: TIME_COL_WIDTH + createGhost.courtIndex * colWidth + 5,
                  width: colWidth - 10,
                  height: Math.max((createGhost.durationMinutes / 30) * slotHeight - 3, 22),
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

            {/* Click-create ghost (single click, no drag) */}
            {!createGhost && activeDraft && (() => {
              const draftCourtIdx = visibleCourts.findIndex((c) => c.id === activeDraft.courtId)
              if (draftCourtIdx < 0 || activeDraft.startMin < gridStart || activeDraft.startMin >= gridEnd) return null
              const dur = activeDraft.durationMinutes
              return (
                <div
                  className="booking-block-create-preview absolute is-pending"
                  style={{
                    top: ((activeDraft.startMin - gridStart) / 30) * slotHeight + 2,
                    left: TIME_COL_WIDTH + draftCourtIdx * colWidth + 5,
                    width: colWidth - 10,
                    height: Math.max((dur / 30) * slotHeight - 3, 22),
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <p className="text-[11px] font-bold leading-tight">Nueva reserva</p>
                  <p className="text-[10px] font-mono leading-tight opacity-70">
                    {minutesToTime(activeDraft.startMin)} – {minutesToTime(activeDraft.startMin + dur)}
                  </p>
                </div>
              )
            })()}

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
                      className="absolute left-0 right-0 text-center text-[9px] font-bold tabular-nums leading-none"
                      style={{ color: 'var(--now-line)', transform: 'translateY(-160%)' }}
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
            setSelectedBooking(quickPopover.booking)
            setQuickPopover(null)
          }}
        />
      )}

      <BookingDetailDrawer
        booking={selectedBooking ?? null}
        onClose={() => setSelectedBooking(null)}
        closeTimeMinutes={selectedBooking ? courts.find(c => c.id === selectedBooking.courtId)?.closeTimeMinutes : undefined}
        openTimeMinutes={selectedBooking ? courts.find(c => c.id === selectedBooking.courtId)?.openTimeMinutes : undefined}
        adminAllowedDurations={selectedBooking ? courts.find(c => c.id === selectedBooking.courtId)?.adminAllowedDurations : undefined}
        defaultEditing={false}
      />

    </>
  )
}
