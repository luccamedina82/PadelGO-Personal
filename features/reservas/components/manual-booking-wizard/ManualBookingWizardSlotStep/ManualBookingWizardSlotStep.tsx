import { useEffect } from 'react'
import type { Court, CourtSlots } from '../types/manualBookingWizard.types'
import { computeEndTime } from '../helpers/manualBookingWizard.helpers'

interface ManualBookingWizardSlotStepProps {
  date: string
  startTime: string
  setStartTime(v: string): void
  duration: number
  setDuration(v: number): void
  courtId: string
  setCourtId(v: string): void
  courts: Court[]
  courtSlotsByDate: Record<string, CourtSlots[]>
  durationOptions: number[]
  onComplete(): void
}

export default function ManualBookingWizardSlotStep({
  date,
  startTime,
  setStartTime,
  duration,
  setDuration,
  courtId,
  setCourtId,
  courts,
  courtSlotsByDate,
  durationOptions,
  onComplete,
}: ManualBookingWizardSlotStepProps) {
  const allCourtSlots = courtSlotsByDate[date] ?? []

  // Build time map with court availability counts
  const timeMap = new Map<string, { available: boolean; availableCourtCount: number; durationOptions: number[] }>()
  for (const cs of allCourtSlots) {
    for (const slot of cs.slots) {
      const existing = timeMap.get(slot.time)
      if (!existing) {
        timeMap.set(slot.time, {
          available: slot.available,
          availableCourtCount: slot.available ? 1 : 0,
          durationOptions: [...slot.durationOptions],
        })
      } else {
        if (slot.available) { existing.available = true; existing.availableCourtCount++ }
        for (const d of slot.durationOptions) {
          if (!existing.durationOptions.includes(d)) existing.durationOptions.push(d)
        }
      }
    }
  }
  const currentSlots = Array.from(timeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, v]) => ({
      time,
      available: v.available,
      availableCourtCount: v.availableCourtCount,
      durationOptions: v.durationOptions.sort((a, b) => a - b),
    }))

  // Available durations for selected time across all courts
  const availableDurations = new Set<number>()
  if (startTime) {
    for (const cs of allCourtSlots) {
      const slot = cs.slots.find((s) => s.time === startTime)
      if (slot) {
        for (const d of slot.durationOptions) availableDurations.add(d)
      }
    }
  }
  const effectiveDurationOptions = durationOptions.filter(
    (d) => availableDurations.size === 0 || availableDurations.has(d)
  )

  // Auto-select duration when only one option is available
  useEffect(() => {
    if (!startTime) return
    if (effectiveDurationOptions.length === 1) {
      setDuration(effectiveDurationOptions[0]!)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime])

  function handleSelectTime(t: string) {
    setStartTime(t)
    setDuration(0)
    setCourtId('')
  }

  // Available courts for selected time + duration
  const availableCourts = courts.filter((c) => {
    const cs = allCourtSlots.find((x) => x.courtId === c.id)
    const slot = cs?.slots.find((s) => s.time === startTime)
    return slot?.available && slot.durationOptions.includes(duration)
  })
  const unavailableCourts = courts.filter((c) => !availableCourts.some((a) => a.id === c.id))

  const endTime = startTime && duration > 0 ? computeEndTime(startTime, duration) : null

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Time section */}
      <div>
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
                    handleSelectTime(s.time)
                  }}
                  disabled={!s.available && !isActive}
                  className={`py-[8px] px-1 rounded-[10px] border text-[11px] font-mono font-semibold
                              cursor-pointer transition-all duration-[120ms] active:scale-95
                              flex flex-col items-center gap-[3px]
                              ${
                                isActive
                                  ? 'bg-accent border-accent text-accent-text font-bold'
                                  : !s.available
                                    ? 'border-border/40 bg-card/40 text-sub line-through cursor-not-allowed'
                                    : 'border-border bg-card text-muted hover:border-border-hover hover:text-text'
                              }`}
                >
                  <span>{s.time}</span>
                  {!isActive && s.available && (
                    <span className={`text-[8px] font-normal leading-none ${s.availableCourtCount === 1 ? 'text-accent' : 'text-muted'}`}>
                      {s.availableCourtCount === 1 ? '1 cancha' : `${s.availableCourtCount} canchas`}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Duration section — revealed after time, hidden if only one option (auto-selected) */}
      {startTime && effectiveDurationOptions.length > 1 && (
        <div className="animate-wz-fade-in">
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
                    setCourtId('')
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
      )}

      {/* Court section — revealed after duration selection */}
      {startTime && duration > 0 && (
        <div className="animate-wz-fade-in">
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
                    onClick={() => { setCourtId(c.id); onComplete() }}
                    className={`flex items-center gap-[10px] px-[14px] py-[11px] rounded-xl border cursor-pointer
                                transition-all duration-[130ms] active:scale-[.98]
                                ${
                                  isActive
                                    ? 'border-accent bg-accent/8'
                                    : 'border-accent/35 bg-accent/5 hover:border-accent/60 hover:bg-accent/10'
                                }`}
                  >
                    <span className={`size-2 rounded-full shrink-0 transition-colors duration-[130ms]
                                      ${isActive ? 'bg-accent' : 'bg-accent/50'}`} />
                    <span className={`text-sm font-semibold flex-1 text-left ${isActive ? 'text-accent' : 'text-text'}`}>
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
                  <span className="text-sm font-semibold flex-1 text-left text-sub line-through">{c.name}</span>
                  <span className="text-[10px] text-sub">No disponible</span>
                </button>
              ))}
            </div>
          )}

          {endTime && (
            <div className="mt-[14px] flex items-center justify-between px-[14px] py-[10px] rounded-xl bg-accent/8 border border-accent/25">
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
      )}
    </div>
  )
}
