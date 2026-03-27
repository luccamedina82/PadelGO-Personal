import type { Court, CourtSlots } from '../types/manualBookingWizard.types'

interface ManualBookingWizardStep3CourtProps {
  courts: Court[]
  courtId: string
  setCourtId(v: string): void
  date: string
  startTime: string
  duration: number
  courtSlotsByDate: Record<string, CourtSlots[]>
}

export default function ManualBookingWizardStep3Court({
  courts,
  courtId,
  setCourtId,
  date,
  startTime,
  duration,
  courtSlotsByDate,
}: ManualBookingWizardStep3CourtProps) {
  const courtsForDate = courtSlotsByDate[date] ?? []

  const availableCourts = courts.filter((c) => {
    const cs = courtsForDate.find((x) => x.courtId === c.id)
    const slot = cs?.slots.find((s) => s.time === startTime)
    return slot?.available && slot.durationOptions.includes(duration)
  })

  const unavailableCourts = courts.filter((c) => !availableCourts.some((a) => a.id === c.id))

  return (
    <div className="flex flex-col">
      <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
        Cancha
      </p>

      {availableCourts.length === 0 ? (
        <p className="text-xs text-muted text-center py-4">
          Sin canchas disponibles para este horario.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {availableCourts.map((c) => {
            const isActive = courtId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourtId(c.id)}
                className={`flex items-center gap-[10px] px-[14px] py-[11px] rounded-xl border cursor-pointer
                            transition-all duration-[130ms] active:scale-[.98]
                            ${
                              isActive
                                ? 'border-accent bg-accent/8'
                                : 'border-border bg-card hover:border-border-hover hover:bg-card-hover'
                            }`}
              >
                <span
                  className={`size-2 rounded-full shrink-0 transition-colors duration-[130ms]
                              ${isActive ? 'bg-accent' : 'bg-border'}`}
                />
                <span
                  className={`text-sm font-semibold flex-1 text-left
                              ${isActive ? 'text-accent' : 'text-text'}`}
                >
                  {c.name}
                </span>
                <span className="text-[10px] text-muted opacity-60">{c.type}</span>
                {isActive && (
                  <span className="size-[18px] rounded-full bg-accent text-accent-text flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}

          {unavailableCourts.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled
              className="flex items-center gap-[10px] px-[14px] py-[11px] rounded-xl border
                         border-border/40 bg-card/40 cursor-not-allowed opacity-40"
            >
              <span className="size-2 rounded-full shrink-0 bg-border" />
              <span className="text-sm font-semibold flex-1 text-left text-sub line-through">
                {c.name}
              </span>
              <span className="text-[10px] text-sub">No disponible</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
