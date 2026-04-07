'use client'

import { useState } from 'react'
import { useReservasSidebarStore } from '@/store/reservasSidebarStore'
import { COURT_COLORS } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'

// ── Mini Calendar ──────────────────────────────────────────────────────────

function getArgToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value ?? ''
  const m = parts.find(p => p.type === 'month')?.value ?? ''
  const d = parts.find(p => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

const TODAY = getArgToday()

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: string; onSelect: (d: string) => void }) {
  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate || TODAY
    return new Date(`${base}T00:00:00.000Z`)
  })

  const year = viewDate.getUTCFullYear()
  const month = viewDate.getUTCMonth()
  const monthLabel = viewDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const offset = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function dayStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className="px-2 pt-2 pb-1">
      {/* Month header */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <button
          onClick={() => setViewDate(new Date(Date.UTC(year, month - 1, 1)))}
          className="w-5 h-5 flex items-center justify-center text-muted hover:text-text rounded transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[11px] font-semibold text-text capitalize">{monthLabel}</span>
        <button
          onClick={() => setViewDate(new Date(Date.UTC(year, month + 1, 1)))}
          className="w-5 h-5 flex items-center justify-center text-muted hover:text-text rounded transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d} className="text-[9px] font-bold text-muted/50 text-center uppercase tracking-wider py-0.5">
            {d}
          </span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const ds = dayStr(d)
          const isSelected = ds === selectedDate
          const isToday = ds === TODAY
          return (
            <button
              key={i}
              onClick={() => onSelect(ds)}
              className={`flex items-center justify-center h-6 text-[11px] font-medium rounded-full transition-colors
                ${isSelected
                  ? 'bg-accent text-black font-bold'
                  : isToday
                    ? 'text-accent font-semibold hover:bg-card'
                    : 'text-text hover:bg-card'
                }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Slot principal ─────────────────────────────────────────────────────────

export default function ReservasSidebarSlot() {
  const {
    selectedDate,
    courts,
    focusCourtIds,
    todayBookingCount,
    unpaidCount,
    handleDayChange,
    handleToggleCourt,
    handleClearCourts,
  } = useReservasSidebarStore()

  return (
    <>
      {/* Separador */}
      <div className="mx-3 border-t border-border" />

      {/* Mini Calendar */}
      <MiniCalendar selectedDate={selectedDate} onSelect={handleDayChange} />

      {/* Canchas visibles */}
      {courts.length > 0 && (
        <>
          <div className="mx-3 border-t border-border" />
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted/60">Canchas</p>
              {focusCourtIds.length > 0 && (
                <button
                  onClick={handleClearCourts}
                  className="text-[9px] font-semibold text-accent hover:text-accent/80 transition-colors"
                >
                  Todas
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {courts.map((court) => {
                const color = COURT_COLORS[court.colorIndex % COURT_COLORS.length]!
                const isVisible = focusCourtIds.length === 0 || focusCourtIds.includes(court.id)
                return (
                  <button
                    key={court.id}
                    onClick={() => handleToggleCourt(court.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card transition-colors text-left"
                  >
                    {/* Color checkbox — matches FilterBar court chip palette */}
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 transition-all"
                      style={isVisible ? {
                        background: color.bg,
                        borderLeft: `2px solid ${color.bar}`,
                        border: `1px solid color-mix(in srgb, ${color.bar} 45%, transparent)`,
                      } : {
                        background: 'transparent',
                        border: '1px solid var(--border)',
                      }}
                    />
                    <span className={`text-[12px] font-medium truncate flex-1 ${isVisible ? 'text-text' : 'text-muted'}`}>
                      {court.name}
                    </span>
                    {court.isUnderMaintenance && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/70 shrink-0">
                        Mant.
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Mini stats */}
      <div className="mx-3 border-t border-border" />
      <div className="px-4 py-2.5">
        <p className="text-[12px] font-semibold text-text">
          {todayBookingCount} {todayBookingCount === 1 ? 'reserva' : 'reservas'} hoy
        </p>
        {unpaidCount > 0
          ? (
            <p className="text-[11px] font-medium text-red-400 mt-0.5">
              {unpaidCount} sin cobrar
            </p>
          ) : todayBookingCount > 0 ? (
            <p className="text-[11px] font-medium text-green-400 mt-0.5">Al día</p>
          ) : null
        }
      </div>
    </>
  )
}
