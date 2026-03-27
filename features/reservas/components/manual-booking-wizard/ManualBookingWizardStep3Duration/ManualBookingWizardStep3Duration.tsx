import { useEffect } from 'react'
import type { CourtSlots } from '../types/manualBookingWizard.types'
import { computeEndTime } from '../helpers/manualBookingWizard.helpers'

interface ManualBookingWizardStep3DurationProps {
  date: string
  startTime: string
  duration: number
  setDuration(v: number): void
  courtSlotsByDate: Record<string, CourtSlots[]>
  durationOptions: number[]
  onNext(): void
}

export default function ManualBookingWizardStep3Duration({
  date,
  startTime,
  duration,
  setDuration,
  courtSlotsByDate,
  durationOptions,
  onNext,
}: ManualBookingWizardStep3DurationProps) {
  // Find available durations for this time across all courts
  const allCourtSlots = courtSlotsByDate[date] ?? []
  const availableDurations = new Set<number>()
  for (const cs of allCourtSlots) {
    const slot = cs.slots.find((s) => s.time === startTime)
    if (slot) {
      for (const d of slot.durationOptions) availableDurations.add(d)
    }
  }

  // Effective options: intersect durationOptions with what's actually available
  const effectiveOptions = durationOptions.filter(
    (d) => availableDurations.size === 0 || availableDurations.has(d)
  )

  // Auto-skip if only one option: select it and advance
  useEffect(() => {
    if (effectiveOptions.length === 1) {
      const only = effectiveOptions[0]!
      setDuration(only)
      onNext()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endTime = duration > 0 ? computeEndTime(startTime, duration) : null

  return (
    <div className="flex flex-col">
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Duración
        </p>
        <div className="grid grid-cols-3 gap-2">
          {durationOptions.map((d) => {
            const isActive = duration === d
            const isAvailable = availableDurations.size === 0 || availableDurations.has(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (!isAvailable) return
                  setDuration(d)
                  onNext()
                }}
                disabled={!isAvailable}
                className={`p-3 rounded-xl border text-[13px] font-bold cursor-pointer
                            transition-all duration-[130ms] active:scale-95
                            ${
                              isActive
                                ? 'bg-accent border-accent text-accent-text'
                                : !isAvailable
                                  ? 'border-border/40 bg-card/30 text-sub cursor-not-allowed'
                                  : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                            }`}
              >
                {d === 60 ? '1h' : d === 90 ? '1h 30' : d === 120 ? '2h' : `${d} min`}
              </button>
            )
          })}
        </div>
      </div>

      {endTime && (
        <div className="flex items-center justify-between px-[14px] py-[10px] rounded-xl bg-accent/8 border border-accent/25">
          <span className="text-xs text-muted">Fin estimado</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-text">{startTime}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="font-mono font-bold text-sm text-accent">{endTime}</span>
            <span className="text-[10px] text-muted bg-card border border-border px-2 py-0.5 rounded-full ml-1">
              {duration} min
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
