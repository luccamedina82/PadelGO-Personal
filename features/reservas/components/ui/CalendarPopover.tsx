'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { argTodayStr } from '@/lib/date'
import { getMonthAvailability } from '@/features/reservas/actions/bookings'

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export interface CalendarPopoverProps {
  selectedDate: string
  onSelect(date: string): void
  onClose(): void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  clubId?: string
}

export function CalendarPopover({ selectedDate, onSelect, onClose, anchorRef, clubId }: CalendarPopoverProps) {
  const today = argTodayStr()
  const [year, setYear] = useState(() => parseInt(selectedDate.slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data: dateAvailability = {} } = useQuery({
    queryKey: ['month-availability', clubId, year, month],
    queryFn: () => getMonthAvailability(year, month, clubId!),
    enabled: !!clubId,
    staleTime: 300_000,
  })

  // Compute fixed position from anchor button rect
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - 270) })
    }
  }, [anchorRef])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 80)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, anchorRef])

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate()

  // Build calendar grid: 6 rows × 7 cols
  const cells: { dateStr: string; curMonth: boolean }[] = []
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    cells.push({ dateStr: toDateStr(prevYear, prevMonth, d), curMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: toDateStr(year, month, d), curMonth: true })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    cells.push({ dateStr: toDateStr(nextYear, nextMonth, d), curMonth: false })
  }

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  if (!pos) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[200] bg-card border border-border rounded-2xl shadow-2xl p-3 w-[270px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card-hover transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[12px] font-semibold text-text capitalize">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card-hover transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d) => (
          <div key={d} className="h-7 flex items-center justify-center text-[10px] font-bold text-muted/60 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ dateStr, curMonth }) => {
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          const isPast = dateStr < today
          const avail = dateAvailability?.[dateStr]
          // avail is now 0-100 (percentage of available slots)
          const dotColor = avail === undefined
            ? null
            : isSelected
              ? 'bg-white'
              : avail >= 60 ? 'bg-green-500'
              : avail > 0   ? 'bg-amber-400'
              : 'bg-red-500'
          return (
            <button
              key={dateStr}
              onClick={() => { onSelect(dateStr); onClose() }}
              className={`relative h-8 w-full flex items-center justify-center rounded-lg text-[12px] font-medium
                          transition-colors pb-1
                          ${isSelected
                            ? 'bg-accent text-accent-text font-bold'
                            : isToday
                              ? 'ring-1 ring-accent text-accent font-semibold hover:bg-accent/10'
                              : isPast
                                ? 'text-muted/50 opacity-60 hover:bg-card-hover hover:opacity-80'
                                : curMonth
                                  ? 'text-text hover:bg-card-hover'
                                  : 'text-muted/30 hover:bg-card-hover'
                          }`}
            >
              {new Date(`${dateStr}T00:00:00.000Z`).getUTCDate()}
              {dotColor && (
                <span className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 size-[5px] rounded-full border border-background ${dotColor}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <span className="size-[5px] rounded-full bg-green-500 inline-block" />
          <span className="text-[10px] text-muted">Alta</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-[5px] rounded-full bg-amber-400 inline-block" />
          <span className="text-[10px] text-muted">Media</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-[5px] rounded-full bg-red-500 inline-block" />
          <span className="text-[10px] text-muted">Agotado</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
