'use client'

import { calcBookingPrice, formatPrice, timeToMinutes } from '@/lib/availability'
import { computeEndTime, endTimeToMinutes } from '../helpers/manualBookingWizard.helpers'
import { getBlockEndOptions } from '../helpers/blockEndOptions'
import type { FloatingFormCourtSlots } from '@/features/reservas/actions/floatingFormData'

interface DurationPickerSectionProps {
  startTime: string
  courtId: string
  selectedDuration: number
  globalDurations: number[]
  availableDurations: number[]
  courtSlots: FloatingFormCourtSlots[]
  baseEnd?: number
  isLoading: boolean
  onChange: (duration: number) => void
}

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

const MIN_DURATION = 30

export default function DurationPickerSection({
  startTime,
  courtId,
  selectedDuration,
  globalDurations,
  availableDurations,
  courtSlots,
  baseEnd,
  isLoading,
  onChange,
}: DurationPickerSectionProps) {
  const slot = courtSlots.find((cs) => cs.courtId === courtId)?.slots.find((s) => s.time === startTime)
  const pricePerHour = slot?.pricePerHour ?? 0
  const displayOptions = globalDurations.length > 0 ? globalDurations : availableDurations

  // Max available duration: stop at next booking's start time (or baseEnd / midnight)
  const startMin = startTime ? timeToMinutes(startTime) : 0
  const allEnds = startTime && courtId
    ? getBlockEndOptions(startTime, courtId, courtSlots, undefined)
    : []
  const maxDuration = allEnds.length > 0
    ? endTimeToMinutes(allEnds[allEnds.length - 1]) - startMin
    : baseEnd !== undefined
      ? baseEnd - startMin
      : 240

  const canDecrease = selectedDuration > MIN_DURATION
  const canIncrease = selectedDuration > 0 && selectedDuration + 30 <= maxDuration

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-150">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">¿Cuánto tiempo?</span>
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-[72px] rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Cards principales — duraciones del admin */}
          <div className="flex gap-2">
            {displayOptions.filter((d) => d <= maxDuration && availableDurations.includes(d)).map((d) => {
              const isSelected = selectedDuration === d
              const endTime = startTime ? computeEndTime(startTime, d) : null
              const price = pricePerHour > 0 ? calcBookingPrice(pricePerHour, d) : 0

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange(d)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-3 rounded-xl border transition-all cursor-pointer active:scale-[.97] ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_inset] shadow-accent/20'
                      : 'border-border bg-surface hover:border-border-hover hover:bg-card'
                  }`}
                >
                  <span className={`text-[13px] font-bold leading-none ${isSelected ? 'text-accent' : 'text-text'}`}>
                    {fmtDur(d)}
                  </span>
                  {price > 0 && (
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-accent/80' : 'text-muted'}`}>
                      {formatPrice(price)}
                    </span>
                  )}
                  {endTime && (
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-accent/60' : 'text-muted/50'}`}>
                      → {endTime}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Stepper ±30 min para duración personalizada */}
          {startTime && courtId && selectedDuration > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
              <span className="shrink-0 text-[9px] text-muted/50 font-semibold uppercase tracking-wide">±30 min</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canDecrease}
                  onClick={() => onChange(selectedDuration - 30)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface flex items-center justify-center text-muted hover:border-border-hover hover:text-text transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="text-[14px] leading-none select-none">−</span>
                </button>
                <div className="flex flex-col items-center w-20">
                  <span className={`text-[12px] font-semibold leading-tight ${displayOptions.filter((d) => d <= maxDuration && availableDurations.includes(d)).includes(selectedDuration) ? 'text-muted' : 'text-accent'}`}>
                    {fmtDur(selectedDuration)}
                  </span>
                  <span className="text-[10px] font-mono text-muted/50 leading-tight">
                    → {computeEndTime(startTime, selectedDuration)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!canIncrease}
                  onClick={() => onChange(selectedDuration + 30)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface flex items-center justify-center text-muted hover:border-border-hover hover:text-text transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="text-[14px] leading-none select-none">+</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
