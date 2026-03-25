import type { CourtSlots, AvailabilitySlot } from '../types/manualBookingWizard.types'
import { computeEndTime } from '../helpers/manualBookingWizard.helpers'

interface ManualBookingWizardStep2TimeProps {
  date: string
  startTime: string
  setStartTime(v: string): void
  duration: number
  setDuration(v: number): void
  courtSlotsByDate: Record<string, CourtSlots[]>
  durationOptions: number[]
  onNext(): void
  onBack(): void
}

export default function ManualBookingWizardStep2Time({
  date,
  startTime,
  setStartTime,
  duration,
  setDuration,
  courtSlotsByDate,
  durationOptions,
  onNext,
  onBack,
}: ManualBookingWizardStep2TimeProps) {
  // Union of slots across all courts for this date
  const allCourtSlots = courtSlotsByDate[date] ?? []
  const timeMap = new Map<string, { available: boolean; durationOptions: number[] }>()
  for (const cs of allCourtSlots) {
    for (const slot of cs.slots) {
      const existing = timeMap.get(slot.time)
      if (!existing) {
        timeMap.set(slot.time, { available: slot.available, durationOptions: [...slot.durationOptions] })
      } else {
        if (slot.available) existing.available = true
        for (const d of slot.durationOptions) {
          if (!existing.durationOptions.includes(d)) existing.durationOptions.push(d)
        }
      }
    }
  }
  const currentSlots: AvailabilitySlot[] = Array.from(timeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, v]) => ({
      time,
      available: v.available,
      durationOptions: v.durationOptions.sort((a, b) => a - b),
      pricePerHour: 0,
    }))

  const selectedSlot = startTime ? currentSlots.find((s) => s.time === startTime) : null
  const endTime = computeEndTime(startTime, duration)

  return (
    <div className="flex flex-col">
      {/* Time grid */}
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Horario de inicio
        </p>
        {currentSlots.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            Sin disponibilidad configurada para este día.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-[6px]">
            {currentSlots.map((s) => {
              const isActive = startTime === s.time
              return (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => {
                    setStartTime(s.time)
                    if (!s.durationOptions.includes(duration)) {
                      setDuration(s.durationOptions[0] ?? 90)
                    }
                  }}
                  disabled={!s.available && !isActive}
                  className={`py-[10px] px-1 rounded-[10px] border text-[11px] font-mono font-semibold
                              cursor-pointer transition-all duration-[120ms]
                              ${
                                isActive
                                  ? 'bg-accent border-accent text-accent-text font-bold'
                                  : !s.available
                                    ? 'border-border/40 bg-card/40 text-sub line-through cursor-not-allowed'
                                    : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                              }`}
                >
                  {s.time}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Duration */}
      {startTime && (
        <div className="mb-[22px] animate-wz-fade-in">
          <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
            Duración
          </p>
          <div className="grid grid-cols-3 gap-2">
            {durationOptions.map((d) => {
              const isActive = duration === d
              const isAvailable = selectedSlot ? selectedSlot.durationOptions.includes(d) : true
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => isAvailable && setDuration(d)}
                  disabled={!isAvailable}
                  className={`p-3 rounded-xl border text-[13px] font-bold cursor-pointer
                              transition-all duration-[130ms]
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

          <div className="mt-[10px] flex items-center justify-between px-[14px] py-[10px] rounded-xl bg-accent/8 border border-accent/25">
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
        </div>
      )}

      <div className="pt-[10px] flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-5 py-3 rounded-xl border border-border bg-transparent text-muted
                     text-[13px] font-semibold cursor-pointer transition-all duration-[130ms]
                     hover:border-border-hover hover:text-text"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!startTime}
          className="flex-[2] px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
                     cursor-pointer transition-all duration-[130ms] tracking-[0.2px]
                     enabled:hover:bg-accent-dark active:enabled:scale-[.98]
                     disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}
