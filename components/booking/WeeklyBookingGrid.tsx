'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  bookings: WeeklyBookingBlock[]
  weekStart: string // YYYY-MM-DD (Monday)
  gridStart: number // minutes from midnight
  gridEnd: number // minutes from midnight
  onBlockClick?: (booking: WeeklyBookingBlock) => void
}

const SLOT_HEIGHT = 40 // px per 30-min row (smaller for week view)
const TIME_COL_WIDTH = 48 // px

const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ── HELPERS ───────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

function getLocalDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function getBlockClass(source: string, status: string, recurringBookingId?: string | null): string {
  if (status === 'CANCELLED') return 'booking-block-cancelled'
  if (source === 'BLOCK' && recurringBookingId) return 'booking-block-recurring'
  if (source === 'BLOCK') return 'booking-block-block'
  if (source === 'ONLINE') return 'booking-block-online'
  return 'booking-block-manual'
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function WeeklyBookingGrid({
  courts,
  bookings,
  weekStart,
  gridStart,
  gridEnd,
  onBlockClick,
}: WeeklyBookingGridProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedCourt, setSelectedCourt] = useState<string>(courts[0]?.id ?? '')
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{
    booking: WeeklyBookingBlock
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

  const totalSlots = (gridEnd - gridStart) / 30
  const gridHeight = totalSlots * SLOT_HEIGHT

  const courtBookings = bookings.filter((b) => b.courtId === selectedCourt)

  function handleEmptyClick(date: string, slotMinutes: number) {
    const timeStr = minutesToTime(slotMinutes)
    router.push(
      `/admin/reservas/nueva?courtId=${selectedCourt}&date=${encodeURIComponent(date)}&time=${timeStr}`
    )
  }

  function handleBlockClick(booking: WeeklyBookingBlock) {
    if (onBlockClick) {
      onBlockClick(booking)
    } else {
      // Navigate to day view for that booking
      router.push(`/admin/reservas?date=${booking.date}`)
    }
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
          <div className="flex sticky top-0 z-20 bg-surface border-b-2 border-border-hover shrink-0">
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
            {weekDates.map((date, dayIndex) => {
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
                  className={`flex-1 relative border-l border-border ${isToday ? 'bg-accent/[0.02]' : ''}`}
                >
                  {/* Slot click targets */}
                  {Array.from({ length: totalSlots }, (_, i) => {
                    const slotMin = gridStart + i * 30
                    const isHour = slotMin % 60 === 0
                    const slotIsPast =
                      isPast || (isToday && currentMinutes !== null && slotMin < currentMinutes)
                    const courtInactive = !selectedCourtData?.isActive

                    return (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 transition-colors
                                    ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}
                                    ${
                                      slotIsPast || courtInactive
                                        ? 'opacity-40 cursor-not-allowed'
                                        : 'cursor-pointer hover:bg-accent/[0.06]'
                                    }`}
                        style={{
                          top: i * SLOT_HEIGHT,
                          height: SLOT_HEIGHT,
                          background: isHour ? 'var(--grid-row-alt)' : 'transparent',
                        }}
                        onClick={() =>
                          !slotIsPast && !courtInactive && handleEmptyClick(date, slotMin)
                        }
                      />
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
                        onMouseEnter={(e) => setTooltip({ booking: b, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) =>
                          setTooltip((prev) =>
                            prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                          )
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
                      <div className="w-2 h-2 rounded-full bg-accent now-dot -ml-1" />
                      <div className="flex-1 h-px bg-accent opacity-70" />
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
          className="fixed z-[90] pointer-events-none bg-surface border border-border-hover rounded-xl shadow-2xl px-3 py-2 min-w-[160px] max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
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
                  tooltip.booking.paymentStatus === 'PAID' ? 'text-green-400' : 'text-orange-400'
                }`}
              >
                {tooltip.booking.paymentStatus === 'PAID' ? 'Pagado' : 'Pendiente'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
