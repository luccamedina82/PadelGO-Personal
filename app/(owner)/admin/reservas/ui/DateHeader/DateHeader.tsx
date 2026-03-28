'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { argTodayStr } from '@/lib/date'
import { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export { CalendarPopover } from '@/features/reservas/components/ui/CalendarPopover'
export type { CalendarPopoverProps } from '@/features/reservas/components/ui/CalendarPopover'

interface DateHeaderProps {
  selectedDate: string,
  clubId: string
}

export default function DateHeader({ selectedDate, clubId }: DateHeaderProps) {
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
          clubId={clubId}
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
