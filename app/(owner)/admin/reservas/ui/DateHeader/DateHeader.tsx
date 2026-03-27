'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { argTodayStr } from '@/lib/date'

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

interface CalendarPopoverProps {
  selectedDate: string
  onSelect(date: string): void
  onClose(): void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

function CalendarPopover({ selectedDate, onSelect, onClose, anchorRef }: CalendarPopoverProps) {
  const today = argTodayStr()
  const [year, setYear] = useState(() => parseInt(selectedDate.slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1)
  const popoverRef = useRef<HTMLDivElement>(null)

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
          return (
            <button
              key={dateStr}
              onClick={() => { onSelect(dateStr); onClose() }}
              className={`h-8 w-full flex items-center justify-center rounded-lg text-[12px] font-medium
                          transition-colors
                          ${isSelected
                            ? 'bg-accent text-accent-text font-bold'
                            : isToday
                              ? 'ring-1 ring-accent text-accent font-semibold hover:bg-accent/10'
                              : curMonth
                                ? 'text-text hover:bg-card-hover'
                                : 'text-muted/30 hover:bg-card-hover'
                          }`}
            >
              {new Date(`${dateStr}T00:00:00.000Z`).getUTCDate()}
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  )
}

interface DateHeaderProps {
  selectedDate: string
}

export default function DateHeader({ selectedDate }: DateHeaderProps) {
  const router = useRouter()
  const today = argTodayStr()
  const isToday = selectedDate === today
  const prevDay = offsetDate(selectedDate, -1)
  const nextDay = offsetDate(selectedDate, 1)
  const calendarBtnRef = useRef<HTMLButtonElement>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const weekday = dateObj.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const day = dateObj.getUTCDate()
  const month = dateObj.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex items-center gap-1">
      {/* Prev day */}
      <Link
        href={`/admin/reservas?date=${prevDay}`}
        onClick={() => window.dispatchEvent(new CustomEvent('reservas:date-navigating'))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors shrink-0"
        title="Día anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </Link>

      {/* Date label — fixed-width to prevent layout jumps between dates */}
      <h1 className="font-display text-[22px] font-bold text-text capitalize leading-none px-1 text-center min-w-[240px]">
        {weekday}, {day} de {month}
      </h1>

      {/* Next day */}
      <Link
        href={`/admin/reservas?date=${nextDay}`}
        onClick={() => window.dispatchEvent(new CustomEvent('reservas:date-navigating'))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors shrink-0"
        title="Día siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

      {/* Calendar button */}
      <button
        ref={calendarBtnRef}
        onClick={() => setCalendarOpen((o) => !o)}
        title="Ir a una fecha"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors shrink-0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* Custom calendar popover */}
      {calendarOpen && (
        <CalendarPopover
          selectedDate={selectedDate}
          onSelect={(d) => { window.dispatchEvent(new CustomEvent('reservas:date-navigating')); router.push(`/admin/reservas?date=${d}`) }}
          onClose={() => setCalendarOpen(false)}
          anchorRef={calendarBtnRef}
        />
      )}

      {/* Hoy — only visible when not on today */}
      {!isToday && (
        <Link
          href="/admin/reservas"
          onClick={() => window.dispatchEvent(new CustomEvent('reservas:date-navigating'))}
          className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded-lg hover:bg-accent/20 transition-colors"
        >
          Hoy
        </Link>
      )}
    </div>
  )
}
