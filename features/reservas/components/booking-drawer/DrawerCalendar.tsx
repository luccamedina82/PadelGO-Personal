'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { argTodayStr } from '@/lib/date'
import { getMonthAvailability } from '@/features/reservas/actions/bookings'

interface DrawerCalendarProps {
  clubId: string
  selectedDate: string
  onSelect: (date: string) => void
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function DrawerCalendar({ clubId, selectedDate, onSelect }: DrawerCalendarProps) {
  const today = argTodayStr()
  const [year, setYear] = useState(() => parseInt(selectedDate.slice(0, 4)))
  const [month, setMonth] = useState(() => parseInt(selectedDate.slice(5, 7)) - 1)

  const { data: avail = {} } = useQuery({
    queryKey: ['month-availability', clubId, year, month],
    queryFn: () => getMonthAvailability(year, month, clubId),
    staleTime: 300_000,
  })

  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: { dateStr: string; curMonth: boolean }[] = []
  for (let i = 0; i < firstDay; i++) {
    const d = daysInPrev - firstDay + 1 + i
    cells.push({ dateStr: toDateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d), curMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ dateStr: toDateStr(year, month, d), curMonth: true })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ dateStr: toDateStr(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d), curMonth: false })
  }

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div className="animate-in fade-in duration-150">
      {/* Navegación mes */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-[13px] font-semibold text-text capitalize">{monthLabel}</span>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Labels días */}
      <div className="grid grid-cols-7 mb-1">
        {['D','L','M','X','J','V','S'].map((d) => (
          <div key={d} className="h-7 flex items-center justify-center text-[10px] font-bold text-muted/60 uppercase">{d}</div>
        ))}
      </div>

      {/* Grilla */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ dateStr, curMonth }) => {
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          const isPast = dateStr < today
          const pct = avail[dateStr]
          // pct = 0-100: ≥60 alta, >0 media, 0 nula
          const dotColor = pct === undefined ? null
            : isSelected ? 'bg-white'
            : pct >= 60   ? 'bg-green-500'
            : pct > 0     ? 'bg-amber-400'
            : 'bg-red-500'

          return (
            <button
              key={dateStr}
              disabled={isPast && !isToday}
              onClick={() => onSelect(dateStr)}
              className={`relative h-9 w-full flex items-center justify-center rounded-lg text-[12px] font-medium transition-colors pb-1
                ${isSelected
                  ? 'bg-accent text-accent-text font-bold'
                  : isToday
                    ? 'ring-1 ring-accent text-accent font-semibold hover:bg-accent/10'
                    : isPast
                      ? 'text-muted/30 cursor-not-allowed'
                      : curMonth
                        ? 'text-text hover:bg-surface cursor-pointer'
                        : 'text-muted/30 hover:bg-surface cursor-pointer'
                }`}
            >
              {new Date(`${dateStr}T00:00:00.000Z`).getUTCDate()}
              {dotColor && (
                <span className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 size-[5px] rounded-full ${dotColor}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-2.5 border-t border-border/50">
        {[['bg-green-500', 'Alta'], ['bg-amber-400', 'Media'], ['bg-red-500', 'Sin disp.']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-[5px] rounded-full ${color} inline-block`} />
            <span className="text-[10px] text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
