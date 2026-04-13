'use client'

import { useState, useRef, useEffect } from 'react'
import { SOURCE_FILTERS, type SourceFilterKey } from '../helpers/bookingGrid.helpers'

const SOURCE_COLOR_VAR: Record<string, string> = {
  ONLINE:    'var(--booking-unified-bar)',
  MANUAL:    'var(--booking-unified-bar)',
  BLOCK:     'var(--booking-unified-bar)',
  RECURRING: 'var(--booking-unified-bar)',
}

const FILTER_CATEGORIES: { label: string; keys: Array<SourceFilterKey> }[] = [
  { label: 'Reservas', keys: ['ONLINE', 'MANUAL', 'RECURRING'] },
  { label: 'Otros',    keys: ['BLOCK'] },
]

interface BookingGridFilterBarProps {
  typeFilter: SourceFilterKey
  paymentFilter: 'PAID' | 'UNPAID' | null
  onTypeFilterChange: (key: SourceFilterKey) => void
  onPaymentFilterChange: (key: 'PAID' | 'UNPAID' | null) => void
  show24Hours: boolean
  onToggle24Hours: () => void
  hasHiddenBookings: boolean
  todayConflictCount: number
  totalConflictCount: number
  compactMode: boolean
  onToggleCompact: () => void
}

export default function BookingGridFilterBar({
  typeFilter,
  paymentFilter,
  onTypeFilterChange,
  onPaymentFilterChange,
  show24Hours,
  onToggle24Hours,
  hasHiddenBookings,
  todayConflictCount,
  totalConflictCount,
  compactMode,
  onToggleCompact,
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
        style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}
        className={`animate-in fade-in duration-200 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
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

      {/* ── Quick payment filters ─────────────────────────── */}
      <div className="w-px h-4 bg-border shrink-0" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }} />
      <button
        onClick={() => onPaymentFilterChange(paymentFilter === 'UNPAID' ? null : 'UNPAID')}
        style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}
        className={`animate-in fade-in duration-200 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
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
        style={{ animationDelay: '360ms', animationFillMode: 'backwards' }}
        className={`animate-in fade-in duration-200 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
          ${paymentFilter === 'PAID'
            ? 'bg-green-500/12 border-green-500/40 text-green-400'
            : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
          }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${paymentFilter === 'PAID' ? 'bg-green-400' : 'bg-muted/40'}`} />
        Cobradas
      </button>

      <div className="flex-1" />

      {/* ── Right-side controls ──────────────────────────── */}
      <div className="animate-in fade-in duration-200 flex items-center gap-2" style={{ animationDelay: '480ms', animationFillMode: 'backwards' }}>

        {/* OOB indicator */}
        {hasHiddenBookings && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 select-none">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
          </span>
        )}

        {/* Conflicts badge */}
        {totalConflictCount > 0 && (
          <a
            href="/admin/conflictos"
            title={todayConflictCount > 0 ? `${todayConflictCount} conflictos hoy` : `${totalConflictCount} conflictos en total`}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors
              ${todayConflictCount > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                : 'bg-surface border-border text-muted hover:border-border-hover hover:text-text'
              }`}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {todayConflictCount > 0 ? todayConflictCount : totalConflictCount}
          </a>
        )}

        {/* Compact mode toggle */}
        <button
          type="button"
          onClick={onToggleCompact}
          title={compactMode ? 'Vista normal' : 'Vista compacta'}
          className={`h-[26px] px-2.5 rounded-lg border text-[10px] font-semibold transition-colors select-none
            ${compactMode
              ? 'bg-accent/10 border-accent/40 text-accent'
              : 'bg-bg border-border text-muted hover:text-text hover:border-border-hover'
            }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Segmented 24h control */}
        <div className="flex items-center h-[26px] rounded-lg border border-border overflow-hidden bg-bg">
          <button
            type="button"
            onClick={() => { if (show24Hours) onToggle24Hours() }}
            className={`h-full px-2.5 text-[10px] font-semibold transition-colors select-none
              ${!show24Hours ? 'bg-card text-text' : 'text-muted hover:text-text'}`}
          >
            Grilla operativa
          </button>
          <div className="w-px h-full bg-border shrink-0" />
          <button
            type="button"
            onClick={() => { if (!show24Hours) onToggle24Hours() }}
            className={`h-full px-2.5 text-[10px] font-semibold transition-colors select-none
              ${show24Hours ? 'bg-card text-text' : 'text-muted hover:text-text'}`}
          >
            Grilla 24 hrs
          </button>
        </div>
      </div>
    </div>
  )
}
