'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { argTodayStr } from '@/lib/date'
import { getMonthAvailability } from '@/features/reservas/actions/bookings'

interface DrawerStepIntentProps {
  clubId: string
  onSelectDate: (date: string) => void
}

const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function buildNext14Days(today: string): { dateStr: string; dow: string; day: number; month: string }[] {
  const result = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(`${today}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    result.push({
      dateStr,
      dow: DOW_SHORT[d.getUTCDay()],
      day: d.getUTCDate(),
      month: MONTH_SHORT[d.getUTCMonth()],
    })
  }
  return result
}

export default function DrawerStepIntent({ clubId, onSelectDate }: DrawerStepIntentProps) {
  const today = argTodayStr()
  const [showGrid, setShowGrid] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const days = useMemo(() => buildNext14Days(today), [today])

  // Fetch availability for current month (and next if 14-day window spans two months)
  const todayYear = parseInt(today.slice(0, 4))
  const todayMonth = parseInt(today.slice(5, 7)) - 1
  const lastDay = days[days.length - 1]
  const lastYear = parseInt(lastDay.dateStr.slice(0, 4))
  const lastMonth = parseInt(lastDay.dateStr.slice(5, 7)) - 1

  const { data: availCurrent = {} } = useQuery({
    queryKey: ['month-availability', clubId, todayYear, todayMonth],
    queryFn: () => getMonthAvailability(todayYear, todayMonth, clubId),
    enabled: !!clubId,
    staleTime: 300_000,
  })

  const { data: availNext = {} } = useQuery({
    queryKey: ['month-availability', clubId, lastYear, lastMonth],
    queryFn: () => getMonthAvailability(lastYear, lastMonth, clubId),
    enabled: !!clubId && (lastYear !== todayYear || lastMonth !== todayMonth),
    staleTime: 300_000,
  })

  const availability: Record<string, number> = { ...availCurrent, ...availNext }

  function getDotColor(dateStr: string, isSelected: boolean): string | null {
    const avail = availability[dateStr]
    if (avail === undefined) return null
    if (isSelected) return 'bg-white'
    if (avail >= 60) return 'bg-green-500'
    if (avail > 0) return 'bg-amber-400'
    return 'bg-red-500'
  }

  if (showGrid) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-150">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGrid(false)}
            className="text-[12px] font-semibold text-muted hover:text-text transition-colors flex items-center gap-1"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Volver
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Elegir fecha</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map(({ dateStr, dow, day, month }) => {
            const isSelected = selected === dateStr
            const isToday = dateStr === today
            const dotColor = getDotColor(dateStr, isSelected)
            const avail = availability[dateStr]
            const isExhausted = avail !== undefined && avail === 0
            return (
              <button
                key={dateStr}
                type="button"
                disabled={isExhausted}
                onClick={() => {
                  setSelected(dateStr)
                  onSelectDate(dateStr)
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-3 rounded-xl border transition-all active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                  ${isSelected
                    ? 'bg-accent border-accent text-accent-text'
                    : isToday
                      ? 'bg-surface border-accent/60 text-text ring-1 ring-accent/40'
                      : 'bg-surface border-border hover:border-border-hover hover:bg-card text-text'
                  }`}
              >
                <span className={`text-[9px] font-bold uppercase tracking-wide leading-none ${isSelected ? 'text-accent-text/70' : 'text-muted'}`}>
                  {dow}
                </span>
                <span className={`text-[15px] font-bold leading-none ${isSelected ? 'text-accent-text' : 'text-text'}`}>
                  {day}
                </span>
                <span className={`text-[9px] font-semibold leading-none ${isSelected ? 'text-accent-text/70' : 'text-muted'}`}>
                  {month}
                </span>
                {dotColor && (
                  <span className={`absolute bottom-[5px] left-1/2 -translate-x-1/2 size-[5px] rounded-full ${dotColor}`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="size-[5px] rounded-full bg-green-500 inline-block" />
            <span className="text-[10px] text-muted">Alta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-[5px] rounded-full bg-amber-400 inline-block" />
            <span className="text-[10px] text-muted">Media</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-[5px] rounded-full bg-red-500 inline-block" />
            <span className="text-[10px] text-muted">Agotado</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-150">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">¿Cuándo es la reserva?</p>

      <button
        type="button"
        onClick={() => onSelectDate(today)}
        className="flex items-center gap-3 px-4 py-4 rounded-2xl border border-border bg-surface hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer active:scale-[.99] group"
      >
        <span className="text-2xl">📅</span>
        <div className="text-left">
          <p className="text-[14px] font-bold text-text">Hoy</p>
          <p className="text-[12px] text-muted capitalize">
            {new Date(`${today}T00:00:00.000Z`).toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
            })}
          </p>
        </div>
        <svg className="ml-auto text-muted group-hover:text-accent transition-colors" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        onClick={() => setShowGrid(true)}
        className="flex items-center gap-3 px-4 py-4 rounded-2xl border border-border bg-surface hover:border-border-hover hover:bg-card transition-all cursor-pointer active:scale-[.99] group"
      >
        <span className="text-2xl">🗓</span>
        <div className="text-left">
          <p className="text-[14px] font-bold text-text">Elegir fecha</p>
          <p className="text-[12px] text-muted">Con disponibilidad en tiempo real</p>
        </div>
        <svg className="ml-auto text-muted group-hover:text-text transition-colors" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
