'use client'

import { useRef, useState, useEffect } from 'react'
import { SOURCE_FILTERS, type SourceFilterKey } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

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
  unpaidCount: number
  pendingCount: number
  onFocusCourtChange: (id: string | null) => void
  onTypeFilterChange: (key: SourceFilterKey) => void
}

export default function BookingGridFilterBar({
  courts,
  focusCourtId,
  typeFilter,
  unpaidCount,
  pendingCount,
  onFocusCourtChange,
  onTypeFilterChange,
}: BookingGridFilterBarProps) {
  const [courtDropdownOpen, setCourtDropdownOpen] = useState(false)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const courtDropdownRef = useRef<HTMLDivElement>(null)
  const typeDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!courtDropdownOpen && !typeDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (courtDropdownRef.current && !courtDropdownRef.current.contains(e.target as Node)) {
        setCourtDropdownOpen(false)
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [courtDropdownOpen, typeDropdownOpen])

  const selectedCourtName = focusCourtId
    ? courts.find((c) => c.id === focusCourtId)?.name ?? 'Cancha'
    : null

  const activeFilterLabel = typeFilter
    ? SOURCE_FILTERS.find((f) => f.key === typeFilter)?.label
    : null

  return (
    <div className="shrink-0 px-4 py-2 border-b border-border bg-surface flex items-center gap-3 print:hidden">

      {/* KPIs — estado del día, información accionable */}
      <div className="flex items-center gap-2">
        {unpaidCount > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            {unpaidCount} sin cobrar
          </span>
        )}
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            {pendingCount} por confirmar
          </span>
        )}
        {unpaidCount === 0 && pendingCount === 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            Todo al día
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Dropdown selector de cancha (solo si hay más de una) */}
      {courts.length > 1 && (
        <div className="relative" ref={courtDropdownRef}>
          <button
            onClick={() => setCourtDropdownOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${courtDropdownOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {courtDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-[60] min-w-[160px] bg-surface border border-border-hover rounded-xl shadow-2xl py-1 overflow-hidden animate-fadeIn">
              <button
                onClick={() => { onFocusCourtChange(null); setCourtDropdownOpen(false) }}
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
              <div className="mx-3 my-1 h-px bg-border" />
              {courts.map((court) => (
                <button
                  key={court.id}
                  onClick={() => { onFocusCourtChange(court.id); setCourtDropdownOpen(false) }}
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

      {/* Dropdown de tipo de reserva */}
      <div className="relative" ref={typeDropdownRef}>
        <button
          onClick={() => setTypeDropdownOpen((v) => !v)}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
            typeFilter
              ? 'bg-accent/10 text-accent border-accent/40'
              : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
          }`}
        >
          {activeFilterLabel ?? 'Tipo'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {typeDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-[60] min-w-[160px] bg-surface border border-border-hover rounded-xl shadow-2xl py-1 overflow-hidden animate-fadeIn">
            {SOURCE_FILTERS.map(({ key, label }) => {
              const colorVar = key ? SOURCE_COLOR_VAR[key] : null
              const isActive = typeFilter === key
              return (
                <button
                  key={key ?? 'all'}
                  onClick={() => {
                    onTypeFilterChange(typeFilter === key ? null : key)
                    setTypeDropdownOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-accent bg-accent/5' : 'text-muted hover:text-text hover:bg-card'
                  }`}
                >
                  {isActive && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {!isActive && colorVar && (
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${colorVar} 18%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${colorVar} 45%, transparent)`,
                        borderLeft: `2px solid ${colorVar}`,
                      }}
                    />
                  )}
                  {!isActive && !colorVar && <span className="w-[10px]" />}
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
