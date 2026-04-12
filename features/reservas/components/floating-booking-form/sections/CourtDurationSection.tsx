'use client'

import { forwardRef, useState } from 'react'
import { getAvailableDurationsForCourt } from '../helpers/bookingCalcUtils'
import { getBlockEndOptions } from '../helpers/blockEndOptions'
import { endTimeToMinutes } from '../helpers/manualBookingWizard.helpers'
import { timeToMinutes } from '@/lib/availability'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'
import SectionWrapper from './SectionWrapper'

interface CourtDurationSectionProps {
  stepNumber: number
  isComplete: boolean
  isVisible: boolean
  bookingMode: 'RESERVA' | 'BLOQUEO'
  startTime: string
  courtId: string
  duration: number
  courts: CourtColumn[]
  courtSlots: FloatingFormCourtSlots[]
  durationOptions: number[]
  baseEnd?: number
  onCourtDuration: (courtId: string, duration: number) => void
}

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

const CourtDurationSection = forwardRef<HTMLButtonElement, CourtDurationSectionProps>(
  function CourtDurationSection(
    { stepNumber, isComplete, isVisible, bookingMode, startTime, courtId, duration, courts, courtSlots, durationOptions, baseEnd, onCourtDuration },
    ref,
  ) {
    const [showCustomEnd, setShowCustomEnd] = useState(false)
    const [showAllEndTimes, setShowAllEndTimes] = useState(false)
    const isBloqueo = bookingMode === 'BLOQUEO'
    const label = isBloqueo ? 'Cancha' : 'Cancha y duración'

    // Detect if startTime is OOB (no slot data exists for it in courtSlots)
    const isOobStartTime = startTime
      ? !courtSlots.some((cs) => cs.slots.some((s) => s.time === startTime))
      : false

    const courtsForTime = startTime
      ? isBloqueo || isOobStartTime
        ? courts
        : courts.filter((c) => getAvailableDurationsForCourt(startTime, c.id, courtSlots, durationOptions).length > 0)
      : []

    // Custom end time: no cap (show up to midnight), only cap at first booking conflict
    const allCustomEndOptions = startTime && courtId && !isBloqueo
      ? getBlockEndOptions(startTime, courtId, courtSlots, undefined)
      : []
    const baseEndMin = baseEnd ?? Infinity
    // Filter to only in-hours options unless showAllEndTimes
    const customEndOptions = showAllEndTimes
      ? allCustomEndOptions
      : allCustomEndOptions.filter((t) => timeToMinutes(t) <= baseEndMin)
    const hasOobEndTimes = allCustomEndOptions.some((t) => timeToMinutes(t) > baseEndMin)

    return (
      <SectionWrapper stepNumber={stepNumber} label={label} isComplete={isComplete} isVisible={isVisible}>
        {startTime ? (
          <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto [scrollbar-width:thin]">
            {courtsForTime.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">Sin canchas disponibles</p>
            ) : (
              courtsForTime.map((c, idx) => {
                // OOB start time: use global durationOptions as fallback
                const durations = !isBloqueo
                  ? isOobStartTime
                    ? durationOptions
                    : getAvailableDurationsForCourt(startTime, c.id, courtSlots, durationOptions)
                  : []
                const isSel = courtId === c.id

                return (
                  <div
                    key={c.id}
                    onClick={() => isBloqueo && onCourtDuration(c.id, duration)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
                      isSel ? 'border-accent bg-accent/8' : 'border-border bg-card'
                    } ${isBloqueo ? 'cursor-pointer hover:border-border-hover' : ''}`}
                  >
                    <span className={`text-[13px] font-semibold truncate ${isSel ? 'text-accent' : 'text-text'}`}>
                      {c.name}
                    </span>
                    {!isBloqueo && (
                      <div className="flex gap-1 shrink-0 ml-2">
                        {durations.map((d) => (
                          <button
                            key={d}
                            ref={idx === 0 && d === durations[0] ? ref : undefined}
                            type="button"
                            onClick={() => { onCourtDuration(c.id, d); setShowCustomEnd(false) }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all active:scale-95 ${
                              isSel && duration === d && !showCustomEnd
                                ? 'bg-accent text-accent-text'
                                : 'bg-surface border border-border text-muted hover:border-accent/60 hover:text-text'
                            }`}
                          >
                            {fmtDur(d)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border">
            <span className="text-[13px] font-semibold truncate text-muted/30">Esperando hora de inicio...</span>
          </div>
        )}

        {/* Custom end time for RESERVA */}
        {!isBloqueo && courtId && startTime && (
          <div className="mt-1.5">
            {!showCustomEnd ? (
              <button
                type="button"
                onClick={() => setShowCustomEnd(true)}
                className="text-[11px] text-accent hover:text-accent-dark font-semibold transition-colors"
              >
                Personalizar hora fin
              </button>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-1 duration-150">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Hora fin</span>
                  <button
                    type="button"
                    onClick={() => setShowCustomEnd(false)}
                    className="text-[10px] text-muted hover:text-text transition-colors"
                  >
                    ✕ Volver a presets
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customEndOptions.map((t) => {
                    const endMin = endTimeToMinutes(t)   // 00:00 → 1440, not 0
                    const startMin = timeToMinutes(startTime)
                    const dur = endMin - startMin
                    const isSelected = courtId && duration === dur && showCustomEnd
                    const isOobTime = endMin > baseEndMin
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onCourtDuration(courtId, dur)}
                        title={isOobTime ? 'Fuera del horario operativo' : undefined}
                        className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer transition-all active:scale-95 ${
                          isSelected
                            ? isOobTime ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-accent border-accent text-accent-text'
                            : isOobTime
                              ? 'border-amber-500/30 bg-card text-amber-500/70 hover:border-amber-400/60 hover:text-amber-400'
                              : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                        }`}
                      >
                        {t === '00:00' ? '00:00 (medianoche)' : t}
                        {isOobTime && <span className="ml-1 text-[8px]">⚠</span>}
                      </button>
                    )
                  })}
                </div>
                {hasOobEndTimes && (
                  <button
                    type="button"
                    onClick={() => setShowAllEndTimes((v) => !v)}
                    className="mt-1.5 text-[11px] text-muted hover:text-text font-semibold transition-colors"
                  >
                    {showAllEndTimes ? '↑ Ocultar horarios fuera de operación' : '↓ Mostrar todos los horarios'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </SectionWrapper>
    )
  },
)

export default CourtDurationSection
