'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BookingBlock } from '../booking-grid/BookingGrid'
import BookingDetailModal from '../booking-grid/BookingDetailModal/BookingDetailModal'
import {
  SLOT_HEIGHT,
  TIME_COL_WIDTH,
  TOOLTIP_DELAY_MS,
  timeToMinutes,
  minutesToTime,
  formatPrice,
  getLocalDateStr,
  clampTooltipPosition,
  getBlockClass,
} from '../booking-grid/helpers/bookingGrid.helpers'

// ── TYPES ─────────────────────────────────────────────────────────────────

export interface WeeklyBookingBlock {
  id: string
  courtId: string
  date: string // YYYY-MM-DD
  startTime: string // 'HH:MM'
  durationMinutes: number
  status: string
  source: string
  displayName: string
  totalPrice: number
  paymentStatus: string
  recurringBookingId?: string | null
}

export interface CourtColumn {
  id: string
  name: string
  isActive: boolean
}

interface WeeklyBookingGridProps {
  courts: CourtColumn[]
  bookings: BookingBlock[]
  weekStart: string // YYYY-MM-DD (Monday)
  gridStart: number // minutes from midnight
  gridEnd: number // minutes from midnight
}

const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── HELPERS ───────────────────────────────────────────────────────────────

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  const start = new Date(`${weekStart}T00:00:00.000Z`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    dates.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    )
  }
  return dates
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function WeeklyBookingGrid({
  courts,
  bookings,
  weekStart,
  gridStart,
  gridEnd,
}: WeeklyBookingGridProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const slotHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slotHoverPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectedCourt, setSelectedCourt] = useState<string>(courts[0]?.id ?? '')
  const [selectedBooking, setSelectedBooking] = useState<BookingBlock | null>(null)
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
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

  const todayStr = getLocalDateStr()
  const weekDates = getWeekDates(weekStart)

  // Current time line (only for today)
  useEffect(() => {
    function update() {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }
    update()
    const iv = setInterval(update, 60_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    return () => {
      if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    }
  }, [])

  const totalSlots = (gridEnd - gridStart) / 30
  const gridHeight = totalSlots * SLOT_HEIGHT

  const courtBookings = bookings.filter((b) => b.courtId === selectedCourt)

  function handleEmptyClick(date: string, slotMinutes: number) {
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    setSlotTooltip(null)
    const timeStr = minutesToTime(slotMinutes)
    router.push(
      `/admin/reservas/nueva?courtId=${selectedCourt}&date=${encodeURIComponent(date)}&time=${timeStr}&view=week`
    )
  }

  function handleSlotMouseEnter(courtName: string, slotMinutes: number, x: number, y: number) {
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    slotHoverPointerRef.current = { x, y }
    const time = minutesToTime(slotMinutes)
    slotHoverTimerRef.current = setTimeout(() => {
      const pos = clampTooltipPosition(
        slotHoverPointerRef.current.x,
        slotHoverPointerRef.current.y,
        170,
        62
      )
      setSlotTooltip({ courtName, time, x: pos.x, y: pos.y })
    }, TOOLTIP_DELAY_MS)
  }

  function handleSlotMouseMove(x: number, y: number) {
    slotHoverPointerRef.current = { x, y }
    setSlotTooltip((prev) => {
      if (!prev) return prev
      const pos = clampTooltipPosition(x, y, 170, 62)
      return { ...prev, x: pos.x, y: pos.y }
    })
  }

  function handleSlotMouseLeave() {
    if (slotHoverTimerRef.current) clearTimeout(slotHoverTimerRef.current)
    setSlotTooltip(null)
  }

  function handleBlockClick(booking: BookingBlock) {
    setSelectedBooking(booking)
  }

  const selectedCourtData = courts.find((c) => c.id === selectedCourt)

  return (
    <div className="flex flex-col h-full">
      {/* Court tabs */}
      <div className="shrink-0 px-4 py-2 border-b border-border bg-surface flex items-center gap-2 overflow-x-auto">
        {courts.map((court) => (
          <button
            key={court.id}
            onClick={() => setSelectedCourt(court.id)}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedCourt === court.id
                ? 'bg-accent text-accent-text'
                : 'bg-card border border-border text-muted hover:text-text hover:border-border-hover'
            }`}
          >
            {court.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div ref={containerRef} className="grow overflow-auto min-h-0 flex-1">
        <div className="flex flex-col h-full">
          {/* Day headers */}
          <div className="flex sticky top-0 z-30 bg-surface border-b-2 border-border-hover shrink-0">
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              className="shrink-0 border-r border-border"
            />
            {weekDates.map((date, i) => {
              const dateObj = new Date(`${date}T00:00:00.000Z`)
              const day = dateObj.getUTCDate()
              const isToday = date === todayStr
              const isPast = date < todayStr

              return (
                <div
                  key={date}
                  className={`flex-1 flex flex-col items-center justify-center py-2 px-1
                              border-l border-border transition-colors
                              ${isPast ? 'opacity-50' : ''}
                              ${isToday ? 'bg-accent/5' : ''}`}
                >
                  <p
                    className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-accent font-bold' : 'text-muted'}`}
                  >
                    {DOW_LABELS[i]}
                  </p>
                  <p className={`text-sm font-bold ${isToday ? 'text-accent' : 'text-text'}`}>
                    {day}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Grid body */}
          <div className="relative flex flex-1 min-h-0">
            {/* Time labels column */}
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH, height: gridHeight }}
              className="shrink-0 relative border-r border-border bg-bg"
            >
              {Array.from({ length: totalSlots }, (_, i) => {
                const mins = gridStart + i * 30
                const isHour = mins % 60 === 0
                const label = isHour ? minutesToTime(mins) : ''
                return (
                  <div
                    key={i}
                    className={`absolute left-0 right-0 flex items-start justify-end pr-1.5
                                ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}`}
                    style={{
                      top: i * SLOT_HEIGHT,
                      height: SLOT_HEIGHT,
                      background: isHour ? 'var(--grid-row-alt)' : 'transparent',
                    }}
                  >
                    {label && (
                      <span className="text-[9px] font-mono text-muted mt-1 leading-none">
                        {label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Day columns */}
            {weekDates.map((date) => {
              const dayBookings = courtBookings.filter((b) => b.date === date)
              const isToday = date === todayStr
              const isPast = date < todayStr

              // Current time line position (only for today)
              const currentLineTop =
                isToday &&
                currentMinutes !== null &&
                currentMinutes >= gridStart &&
                currentMinutes <= gridEnd
                  ? ((currentMinutes - gridStart) / 30) * SLOT_HEIGHT
                  : null

              return (
                <div
                  key={date}
                  style={{ height: gridHeight }}
                  className={`flex-1 relative border-l border-border ${isToday ? 'bg-accent/2' : ''}`}
                >
                  {/* Slot click targets */}
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const slotEnd = slotMin + 30
                    const isHour = slotMin % 60 === 0
                    const slotIsPast =
                      isPast || (isToday && currentMinutes !== null && slotMin < currentMinutes)
                    const hasBookingAtSlot = dayBookings.some((b) => {
                      const bookingStart = timeToMinutes(b.startTime)
                      const bookingEnd = bookingStart + b.durationMinutes
                      return slotMin < bookingEnd && slotEnd > bookingStart
                    })
                    const courtInactive = !selectedCourtData?.isActive
                    const slotBlocked = slotIsPast || courtInactive || hasBookingAtSlot

                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 transition-colors
                                    ${isHour ? 'bg-(--grid-row-alt)' : ''}
                                    ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}
                                    ${
                                      slotBlocked
                                        ? 'opacity-40 cursor-not-allowed'
                                        : 'group cursor-pointer'
                                    }`}
                        style={{
                          top: i * SLOT_HEIGHT,
                          height: SLOT_HEIGHT,
                        }}
                        onMouseEnter={(e) =>
                          !slotBlocked &&
                          handleSlotMouseEnter(
                            selectedCourtData?.name ?? 'Cancha',
                            slotMin,
                            e.clientX,
                            e.clientY
                          )
                        }
                        onMouseMove={(e) =>
                          !slotBlocked && handleSlotMouseMove(e.clientX, e.clientY)
                        }
                        onMouseLeave={handleSlotMouseLeave}
                        onClick={() => !slotBlocked && handleEmptyClick(date, slotMin)}
                      >
                        {!slotBlocked && (
                          <span className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-150 bg-(--grid-slot-hover) group-hover:opacity-100" />
                        )}
                      </div>
                    )
                  })}

                  {/* Booking blocks */}
                  {dayBookings.map((b) => {
                    const startMin = timeToMinutes(b.startTime)
                    const top = ((startMin - gridStart) / 30) * SLOT_HEIGHT
                    const height = (b.durationMinutes / 30) * SLOT_HEIGHT - 2
                    const blockCls = getBlockClass(b.source, b.status, b.recurringBookingId)

                    if (top < 0 || top > gridHeight) return null

                    return (
                      <div
                        key={b.id}
                        className={`booking-block ${blockCls}`}
                        style={{
                          top: top + 1,
                          left: 3,
                          right: 3,
                          height: Math.max(height, 18),
                        }}
                        onClick={() => handleBlockClick(b)}
                        onMouseEnter={(e) => {
                          const pos = clampTooltipPosition(e.clientX, e.clientY, 200, 88)
                          setTooltip({ booking: b, x: pos.x, y: pos.y })
                        }}
                        onMouseMove={(e) =>
                          setTooltip((prev) => {
                            if (!prev) return null
                            const pos = clampTooltipPosition(e.clientX, e.clientY, 200, 88)
                            return { ...prev, x: pos.x, y: pos.y }
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <p className="text-[10px] font-bold leading-tight truncate">
                          {b.displayName}
                        </p>
                        {height > 28 && (
                          <p className="text-[8px] font-mono leading-tight opacity-70">
                            {b.startTime}
                          </p>
                        )}
                        {/* Payment status dot */}
                        {b.source !== 'BLOCK' && b.status !== 'CANCELLED' && (
                          <div
                            className={`absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full ${
                              b.paymentStatus === 'PAID'
                                ? 'bg-green-400'
                                : b.paymentStatus === 'MANUAL'
                                  ? 'bg-gray-400'
                                  : 'bg-orange-400'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Current time line (only on today) */}
                  {currentLineTop !== null && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{ top: currentLineTop }}
                    >
                      <div className="w-2 h-2 rounded-full now-dot -ml-1" style={{ background: 'var(--now-line)' }} />
                      <div className="flex-1 h-px opacity-70" style={{ background: 'var(--now-line)' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-surface/95 backdrop-blur-md border border-border-hover/70 rounded-xl shadow-2xl px-3 py-2 min-w-40 max-w-50"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-xs font-semibold text-text truncate mb-0.5">
            {tooltip.booking.displayName}
          </p>
          <p className="text-[10px] font-mono text-muted">
            {tooltip.booking.startTime} · {tooltip.booking.durationMinutes}m
          </p>
          {tooltip.booking.source !== 'BLOCK' && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] font-mono text-text">
                {formatPrice(tooltip.booking.totalPrice)}
              </span>
              <span
                className={`text-[9px] font-bold ${
                  tooltip.booking.paymentStatus === 'PAID'
                    ? 'text-green-400'
                    : tooltip.booking.paymentStatus === 'MANUAL'
                      ? 'text-muted'
                      : 'text-orange-400'
                }`}
              >
                {tooltip.booking.paymentStatus === 'PAID'
                  ? 'Pagado'
                  : tooltip.booking.paymentStatus === 'MANUAL'
                    ? 'Manual'
                    : 'Pendiente'}
              </span>
            </div>
          )}
        </div>
      )}

      {slotTooltip && !tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-surface/95 backdrop-blur-md border border-border-hover/70 rounded-xl shadow-2xl px-3 py-2.5"
          style={{ left: slotTooltip.x, top: slotTooltip.y }}
        >
          <p className="text-[10px] uppercase tracking-wider text-muted leading-none">Disponible</p>
          <p className="text-[11px] font-semibold text-text leading-none mt-1">{slotTooltip.courtName}</p>
          <p className="text-[10px] font-mono text-muted mt-1">{slotTooltip.time}</p>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  )
}
