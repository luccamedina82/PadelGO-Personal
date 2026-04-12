'use client'

import { formatPrice } from '@/lib/availability'
import { formatDateShort, computeEndTime } from '../helpers/manualBookingWizard.helpers'

interface QuickSummaryProps {
  courtName: string
  startTime: string
  duration: number
  date: string
  basePrice: number
  isLoadingPrice: boolean
  /** true = duración elegida por drag (1B). false = sugerida, aún editable (1A) */
  durationLocked?: boolean
  onExpand: () => void
}

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

export default function QuickSummary({
  courtName, startTime, duration, date, basePrice, isLoadingPrice, durationLocked = true, onExpand,
}: QuickSummaryProps) {
  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null

  return (
    <div className="flex items-start justify-between gap-2 px-3 py-2.5 bg-surface border border-border rounded-xl">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">

        {/* Línea cancha — siempre confirmada */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-green-500 leading-none">✓</span>
          <span className="text-[13px] font-semibold text-text truncate">{courtName || '—'}</span>
        </div>

        {/* Línea hora — ✓ si drag (1B), · si clic (1A, duración aún editable) */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold leading-none ${durationLocked ? 'text-green-500' : 'text-muted'}`}>
            {durationLocked ? '✓' : '·'}
          </span>
          <span className="text-[12px] text-muted">
            {formatDateShort(date)}
            {startTime ? ` · ${startTime}` : ''}
            {endTime ? ` → ${endTime}` : ''}
            {duration > 0 ? ` · ${fmtDur(duration)}` : ''}
          </span>
        </div>

        {/* Precio — se actualiza en tiempo real al cambiar duración */}
        <div className="ml-3.5 mt-0.5 h-4">
          {isLoadingPrice ? (
            <span className="text-[11px] text-muted/40">Calculando…</span>
          ) : basePrice > 0 ? (
            <span className="text-[12px] font-bold text-accent">{formatPrice(basePrice)}</span>
          ) : null}
        </div>

      </div>
      <button
        type="button"
        onClick={onExpand}
        className="shrink-0 text-[11px] font-semibold text-muted hover:text-text transition-colors px-2 py-1 rounded-lg hover:bg-surface mt-0.5"
      >
        Editar
      </button>
    </div>
  )
}
