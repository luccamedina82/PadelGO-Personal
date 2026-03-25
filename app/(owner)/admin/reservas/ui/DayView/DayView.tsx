'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { argTodayStr } from '@/lib/date'

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export default function DateNavigation({ selectedDate }: { selectedDate: string }) {
  const today = argTodayStr()
  const stripRef = useRef<HTMLDivElement>(null)

  // 5 días centrados en la fecha seleccionada: -2, -1, hoy, +1, +2
  const navDates = Array.from({ length: 5 }, (_, i) => offsetDate(selectedDate, i - 2))

  const prevDay = offsetDate(selectedDate, -1)
  const nextDay = offsetDate(selectedDate, 1)

  return (
    <div className="flex items-center gap-1.5 print:hidden">

      {/* Hoy — siempre ocupa espacio para evitar layout shift, solo visible cuando estás en otro día */}
      <Link
        href="/admin/reservas?view=day"
        aria-hidden={selectedDate === today}
        className={`shrink-0 px-2.5 py-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded-lg hover:bg-accent/20 transition-colors ${
          selectedDate === today ? 'invisible pointer-events-none' : ''
        }`}
      >
        Hoy
      </Link>

      {/* Día anterior */}
      <Link
        href={`/admin/reservas?date=${prevDay}&view=day`}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
        title="Día anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </Link>

      {/* Strip de 5 días */}
      <div ref={stripRef} className="flex gap-1">
        {navDates.map((d) => {
          const dObj = new Date(`${d}T00:00:00.000Z`)
          const dow = DOW_LABELS[dObj.getUTCDay()]
          const day = dObj.getUTCDate()
          const isToday = d === today
          const isSelected = d === selectedDate
          return (
            <Link
              key={d}
              href={`/admin/reservas?date=${d}&view=day`}
              data-selected={isSelected ? 'true' : undefined}
              className={`flex flex-col items-center px-2.5 py-1 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-text font-bold'
                  : isToday
                  ? 'bg-accent/10 text-accent font-semibold border border-accent/30'
                  : 'bg-card border border-border text-muted hover:text-text hover:border-border-hover'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider leading-none mb-0.5">{dow}</span>
              <span className="text-sm font-bold leading-tight">{day}</span>
            </Link>
          )
        })}
      </div>

      {/* Día siguiente */}
      <Link
        href={`/admin/reservas?date=${nextDay}&view=day`}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
        title="Día siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>

    </div>
  )
}
