'use client'

import { COURT_COLORS, SOURCE_FILTERS, type SourceFilterKey } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

const SOURCE_COLOR_VAR: Record<string, string> = {
  ONLINE:         'var(--booking-online-bar)',
  MANUAL:         'var(--booking-manual-bar)',
  BLOCK:          'var(--booking-block-bar)',
  RECURRING:      'var(--booking-recurring-bar)',
  ENTRENAMIENTO:  'var(--booking-entrenamiento-bar)',
  TORNEO:         'var(--booking-torneo-bar)',
  EVENTO:         'var(--booking-evento-bar)',
  MANTENIMIENTO:  'var(--booking-mantenimiento-bar)',
}

interface BookingGridFilterBarProps {
  courts: CourtColumn[]
  focusCourtIds: string[]
  typeFilter: SourceFilterKey
  unpaidCount: number
  pendingCount: number
  onCourtToggle: (id: string) => void
  onClearCourts: () => void
  onTypeFilterChange: (key: SourceFilterKey) => void
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
  unpaidCount,
  pendingCount,
  onCourtToggle,
  onClearCourts,
  onTypeFilterChange,
}: BookingGridFilterBarProps) {
  return (
    <div className="shrink-0 px-3 py-1.5 border-b border-border bg-surface flex items-center gap-2 flex-wrap print:hidden min-h-[40px]">

      {/* ── Tipo de reserva ─────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider select-none">Tipo</span>
        {SOURCE_FILTERS.map(({ key, label }) => {
          const isActive = typeFilter === key
          const colorVar = key ? SOURCE_COLOR_VAR[key] : null
          return (
            <button
              key={key ?? 'all'}
              onClick={() => onTypeFilterChange(isActive ? null : key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all select-none
                ${isActive
                  ? 'border-transparent'
                  : 'bg-card border-border text-muted hover:text-text hover:border-border-hover'
                }`}
              style={isActive && colorVar ? {
                background: `color-mix(in srgb, ${colorVar} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${colorVar} 45%, transparent)`,
                color: colorVar,
              } : isActive ? {
                background: 'var(--surface)',
                borderColor: 'var(--border-hover)',
                color: 'var(--text)',
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
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Divisor ─────────────────────────────────────── */}
      {courts.length > 1 && (
        <div className="w-px h-4 bg-border shrink-0" />
      )}

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
    </div>
  )
}
