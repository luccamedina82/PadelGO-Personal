import type { CourtSlots, AvailabilitySlot } from '../types/manualBookingWizard.types'

interface ManualBookingWizardStep2TimeProps {
  date: string
  startTime: string
  setStartTime(v: string): void
  courtSlotsByDate: Record<string, CourtSlots[]>
  onNext(): void
}

export default function ManualBookingWizardStep2Time({
  date,
  startTime,
  setStartTime,
  courtSlotsByDate,
  onNext,
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

  return (
    <div className="flex flex-col">
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
                    if (!s.available && !isActive) return
                    setStartTime(s.time)
                    onNext()
                  }}
                  disabled={!s.available && !isActive}
                  className={`py-[10px] px-1 rounded-[10px] border text-[11px] font-mono font-semibold
                              cursor-pointer transition-all duration-[120ms] active:scale-95
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
    </div>
  )
}
