'use client'

import { argTodayStr } from '@/lib/date'

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

interface DateHeaderProps {
  selectedDate: string
  clubId: string
  onDayChange: (date: string) => void
  isPending?: boolean
}

export default function DateHeader({ selectedDate, clubId: _clubId, onDayChange, isPending = false }: DateHeaderProps) {
  const today = argTodayStr()
  const isToday = selectedDate === today
  const prevDay = offsetDate(selectedDate, -1)
  const nextDay = offsetDate(selectedDate, 1)

  const dateObj = new Date(`${selectedDate}T00:00:00.000Z`)
  const weekday = dateObj.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const day = dateObj.getUTCDate()
  const month = dateObj.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex items-center gap-1">
      {/* Prev day */}
      <button
        onClick={() => onDayChange(prevDay)}
        disabled={isPending}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors shrink-0"
        title="Día anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Date label */}
      <div className="relative flex items-center justify-center min-w-[240px]">
        <h1 className={`font-display text-[22px] font-bold text-text capitalize leading-none px-1 text-center transition-opacity ${isPending ? 'opacity-50' : 'opacity-100'}`}>
          {weekday}, {day} de {month}
        </h1>
        {isPending && (
          <div className="absolute center top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* Next day */}
      <button
        onClick={() => onDayChange(nextDay)}
        disabled={isPending}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors shrink-0"
        title="Día siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Hoy button */}
      {!isToday && (
        <button
          onClick={() => onDayChange(today)}
          disabled={isPending}
          className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded-lg hover:bg-accent/20 transition-colors"
        >
          Hoy
        </button>
      )}
    </div>
  )
}
