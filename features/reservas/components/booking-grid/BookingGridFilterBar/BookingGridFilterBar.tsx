'use client'

import { useRef, useState, useEffect } from 'react'
import { SOURCE_FILTERS, type SourceFilterKey } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

// CSS var por cada key de filtro (para el dot de color = leyenda integrada)
const SOURCE_COLOR_VAR: Record<string, string> = {
  ONLINE: 'var(--booking-online-bar)',
  MANUAL: 'var(--booking-manual-bar)',
  BLOCK: 'var(--booking-block-bar)',
  RECURRING: 'var(--booking-recurring-bar)',
}

interface BookingGridFilterBarProps {
  courts: CourtColumn[]
  focusCourtId: string | null
  typeFilter: SourceFilterKey
  bookingCount: number
  onFocusCourtChange: (id: string | null) => void
  onTypeFilterChange: (key: SourceFilterKey) => void
}

export default function BookingGridFilterBar({
  courts,
  focusCourtId,
  typeFilter,
  bookingCount,
  onFocusCourtChange,
  onTypeFilterChange,
}: BookingGridFilterBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const selectedCourtName = focusCourtId
    ? courts.find((c) => c.id === focusCourtId)?.name ?? 'Cancha'
    : null

  return (
    <div className="shrink-0 px-4 py-1.5 border-b border-border bg-surface flex flex-wrap items-center gap-x-3 gap-y-1.5 print:hidden">

      {/* Dropdown selector de cancha (solo si hay más de una) */}
      {courts.length > 1 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
              focusCourtId
                ? 'bg-accent/10 text-accent border-accent/40'
                : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {selectedCourtName ?? 'Todas las canchas'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 min-w-[160px] bg-surface border border-border-hover rounded-xl shadow-2xl py-1 overflow-hidden animate-fadeIn">
              {/* Opción: todas */}
              <button
                onClick={() => { onFocusCourtChange(null); setDropdownOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors ${
                  !focusCourtId ? 'text-accent bg-accent/5' : 'text-muted hover:text-text hover:bg-card'
                }`}
              >
                {!focusCourtId && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {focusCourtId && <span className="w-[10px]" />}
                Todas las canchas
              </button>

              {/* Separador */}
              <div className="mx-3 my-1 h-px bg-border" />

              {/* Cada cancha */}
              {courts.map((court) => (
                <button
                  key={court.id}
                  onClick={() => { onFocusCourtChange(court.id); setDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors ${
                    focusCourtId === court.id ? 'text-accent bg-accent/5' : 'text-muted hover:text-text hover:bg-card'
                  }`}
                >
                  {focusCourtId === court.id && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {focusCourtId !== court.id && <span className="w-[10px]" />}
                  {court.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros de tipo — cada botón es a la vez filtro y leyenda de color */}
      <div className="flex items-center gap-1 flex-wrap">
        {SOURCE_FILTERS.map(({ key, label }) => {
          const colorVar = key ? SOURCE_COLOR_VAR[key] : null
          const isActive = typeFilter === key
          return (
            <button
              key={key ?? 'all'}
              onClick={() => onTypeFilterChange(typeFilter === key ? null : key)}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors ${
                isActive
                  ? 'bg-accent text-accent-text border-accent'
                  : 'text-muted border-border hover:text-text hover:border-border-hover'
              }`}
            >
              {colorVar && (
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${colorVar} 18%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${colorVar} 45%, transparent)`,
                    borderLeft: `2px solid ${colorVar}`,
                  }}
                />
              )}
              {label}
            </button>
          )
        })}
      </div>

      {/* Conteo de reservas activas */}
      <span className="ml-auto text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-tag text-tag-text border border-tag-border">
        {bookingCount} {bookingCount === 1 ? 'reserva' : 'reservas'}
      </span>
    </div>
  )
}
