'use client'

import { useLayoutEffect, useRef } from 'react'
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

  // 21 días centrados en la fecha seleccionada
  const navDates = Array.from({ length: 21 }, (_, i) => offsetDate(selectedDate, i - 10))

  const prevDay = offsetDate(selectedDate, -1)
  const nextDay = offsetDate(selectedDate, 1)

  // useLayoutEffect: corre antes del paint para evitar el flash de scroll
  useLayoutEffect(() => {
    const container = stripRef.current
    if (!container) return
    const selected = container.querySelector('[data-selected="true"]') as HTMLElement | null
    if (!selected) return
    const scrollTarget = selected.offsetLeft - container.offsetWidth / 2 + selected.offsetWidth / 2
    container.scrollLeft = Math.max(0, scrollTarget)
  }, [selectedDate])

  return (
    <div className="px-5 pb-2 print:hidden">
      <div className="flex items-center gap-2">

        {/* Día anterior */}
        <Link
          href={`/admin/reservas?date=${prevDay}&view=day`}
          className="shrink-0 self-center w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
          title="Día anterior"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        {/* Strip de días */}
        <div
          ref={stripRef}
          className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* flex-1 en cada tile: llenan el ancho disponible en desktop y desbordan (scroll) en mobile */}
          <div className="flex gap-1.5">
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
                  className={`flex-1 min-w-[44px] flex flex-col items-center px-1 py-1.5 rounded-xl text-xs transition-colors ${isSelected ? 'bg-accent text-accent-text font-bold' : isToday ? 'bg-accent/10 text-accent font-semibold border border-accent/30' : 'bg-card border border-border text-muted hover:text-text hover:border-border-hover'}`}
                >
                  <span className="text-[9px] uppercase tracking-wider leading-none mb-0.5">{dow}</span>
                  <span className="text-base font-bold leading-tight">{day}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Día siguiente */}
        <Link
          href={`/admin/reservas?date=${nextDay}&view=day`}
          className="shrink-0 self-center w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border text-muted hover:text-text hover:border-border-hover transition-colors"
          title="Día siguiente"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>

      </div>
    </div>
  )
}
