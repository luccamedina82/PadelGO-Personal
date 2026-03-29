'use client'

import { useState, useRef, useEffect } from 'react'
import { COURT_COLORS, SOURCE_FILTERS, type SourceFilterKey } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

const SOURCE_COLOR_VAR: Record<string, string> = {
  ONLINE:         'var(--booking-unified-bar)',
  MANUAL:         'var(--booking-unified-bar)',
  BLOCK:          'var(--booking-unified-bar)',
  RECURRING:      'var(--booking-unified-bar)',
  ENTRENAMIENTO:  'var(--booking-unified-bar)',
  TORNEO:         'var(--booking-unified-bar)',
  EVENTO:         'var(--booking-unified-bar)',
  MANTENIMIENTO:  '#6b7280',
}

const FILTER_CATEGORIES: { label: string; keys: Array<SourceFilterKey> }[] = [
  { label: 'Reservas',    keys: ['ONLINE', 'MANUAL', 'RECURRING'] },
  { label: 'Actividades', keys: ['ENTRENAMIENTO', 'TORNEO', 'EVENTO', 'MANTENIMIENTO'] },
  { label: 'Otros',       keys: ['BLOCK'] },
]

interface BookingGridFilterBarProps {
  courts: CourtColumn[]
  focusCourtIds: string[]
  typeFilter: SourceFilterKey
  paymentFilter: 'PAID' | 'UNPAID' | null
  unpaidCount: number
  onCourtToggle: (id: string) => void
  onClearCourts: () => void
  onTypeFilterChange: (key: SourceFilterKey) => void
  onPaymentFilterChange: (key: 'PAID' | 'UNPAID' | null) => void
}

function courtLabel(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? name
  return last.length <= 3 ? last : last.slice(0, 2)
}

export default function BookingGridFilterBar({
  courts,
  focusCourtIds,
  typeFilter,
  paymentFilter,
  unpaidCount,
  onCourtToggle,
  onClearCourts,
  onTypeFilterChange,
  onPaymentFilterChange,
}: BookingGridFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!filtersOpen) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setFiltersOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setFiltersOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  const activeFilter = SOURCE_FILTERS.find((f) => f.key === typeFilter)
  const activeColor = typeFilter ? SOURCE_COLOR_VAR[typeFilter] : null

  return (
    <div className="relative shrink-0 px-3 py-1.5 border-b border-border bg-surface flex items-center gap-2 print:hidden min-h-[40px]">

      {/* ── Filtros button ───────────────────────────────── */}
      <button
        ref={btnRef}
        onClick={() => setFiltersOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
          ${typeFilter !== null
            ? 'border-transparent'
            : filtersOpen
              ? 'bg-card border-border-hover text-text'
              : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
          }`}
        style={typeFilter !== null && activeColor ? {
          background: `color-mix(in srgb, ${activeColor} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${activeColor} 45%, transparent)`,
          color: activeColor,
        } : undefined}
      >
        {typeFilter !== null && activeColor && (
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{
              background: `color-mix(in srgb, ${activeColor} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${activeColor} 45%, transparent)`,
              borderLeft: `2px solid ${activeColor}`,
            }}
          />
        )}
        {typeFilter !== null ? activeFilter?.label : 'Filtros'}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-150 ${filtersOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Dropdown panel ───────────────────────────────── */}
      {filtersOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-3 mt-1 z-[100] bg-card border border-border rounded-xl shadow-xl p-2 w-[200px] animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Clear / All */}
          <button
            onClick={() => { onTypeFilterChange(null); setFiltersOpen(false) }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors
              ${typeFilter === null ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text hover:bg-card-hover'}`}
          >
            Todos
          </button>

          {FILTER_CATEGORIES.map(({ label, keys }) => (
            <div key={label} className="mt-1.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted/50 px-2.5 pb-0.5">{label}</p>
              {keys.map((key) => {
                const filter = SOURCE_FILTERS.find((f) => f.key === key)
                if (!filter) return null
                const colorVar = key ? SOURCE_COLOR_VAR[key] : null
                const isActive = typeFilter === key
                return (
                  <button
                    key={key ?? 'all'}
                    onClick={() => { onTypeFilterChange(isActive ? null : key); setFiltersOpen(false) }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors
                      ${isActive ? '' : 'text-muted hover:text-text hover:bg-card-hover'}`}
                    style={isActive && colorVar ? {
                      background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
                      color: colorVar,
                    } : undefined}
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
                    {filter.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Quick filters ────────────────────────────────── */}
      <div className="w-px h-4 bg-border shrink-0" />
      <button
        onClick={() => onPaymentFilterChange(paymentFilter === 'UNPAID' ? null : 'UNPAID')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
          ${paymentFilter === 'UNPAID'
            ? 'bg-orange-500/12 border-orange-500/40 text-orange-400'
            : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${paymentFilter === 'UNPAID' ? 'bg-orange-400' : 'bg-muted/40'}`} />
        Sin cobrar
      </button>
      <button
        onClick={() => onPaymentFilterChange(paymentFilter === 'PAID' ? null : 'PAID')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
          ${paymentFilter === 'PAID'
            ? 'bg-green-500/12 border-green-500/40 text-green-400'
            : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${paymentFilter === 'PAID' ? 'bg-green-400' : 'bg-muted/40'}`} />
        Cobradas
      </button>

      {/* ── Divisor ─────────────────────────────────────── */}
      {courts.length > 1 && <div className="w-px h-4 bg-border shrink-0" />}

      {/* ── Canchas ─────────────────────────────────────── */}
      {courts.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider select-none">Cancha</span>
          <button
            onClick={onClearCourts}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
              ${focusCourtIds.length === 0
                ? 'bg-accent/10 border-accent/40 text-accent'
                : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
              }`}
          >
            Todas
          </button>
          {courts.map((court, idx) => {
            const isActive = focusCourtIds.includes(court.id)
            const color = COURT_COLORS[idx % COURT_COLORS.length]!
            return (
              <button
                key={court.id}
                onClick={() => onCourtToggle(court.id)}
                title={court.name}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none"
                style={isActive ? {
                  background: color.bg,
                  borderColor: `color-mix(in srgb, ${color.bar} 50%, transparent)`,
                  color: color.text,
                } : {
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--muted)',
                }}
              >
                {courtLabel(court.name)}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1" />

      {/* ── KPIs ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {unpaidCount > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            {unpaidCount} sin cobrar
          </span>
        )}
        {unpaidCount === 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            Todo al día
          </span>
        )}
      </div>
    </div>
  )
}
