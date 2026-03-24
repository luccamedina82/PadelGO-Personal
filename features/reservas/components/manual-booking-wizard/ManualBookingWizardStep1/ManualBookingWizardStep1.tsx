import type { Court, CourtSlots, AvailabilitySlot } from '../types/manualBookingWizard.types'
import { computeEndTime } from '../helpers/manualBookingWizard.helpers'

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface ManualBookingWizardStep1Props {
  courts: Court[]
  courtId: string
  setCourtId(v: string): void
  date: string
  setDate(v: string): void
  startTime: string
  setStartTime(v: string): void
  duration: number
  setDuration(v: number): void
  courtSlotsByDate: Record<string, CourtSlots[]>
  availableDates: string[]
  onNext(): void
  durationOptions: number[]
}

export default function ManualBookingWizardStep1({
  courts,
  courtId,
  setCourtId,
  date,
  setDate,
  startTime,
  setStartTime,
  duration,
  setDuration,
  courtSlotsByDate,
  availableDates,
  onNext,
  durationOptions,
}: ManualBookingWizardStep1Props) {
  const currentSlots: AvailabilitySlot[] = courtId
    ? ((courtSlotsByDate[date] ?? []).find((cs) => cs.courtId === courtId)?.slots ?? [])
    : []

  const selectedSlot = startTime ? currentSlots.find((s) => s.time === startTime) : null
  const endTime = computeEndTime(startTime, duration)

  function handleDateChange(d: string) {
    setDate(d)
    setStartTime('')
  }

  function handleCourtChange(id: string) {
    setCourtId(id)
    setStartTime('')
  }

  return (
    <div className="flex flex-col">
      {/* Court */}
      <div className="mb-[22px]">
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
          Cancha
        </p>
        <div className="flex flex-col gap-2">
          {courts.map((c) => {
            const isActive = courtId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCourtChange(c.id)}
                className={`flex items-center gap-[10px] px-[14px] py-[11px] rounded-xl border cursor-pointer
                            transition-all duration-[130ms]
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
        </div>
      </div>

      {/* Date */}
      {courtId && (
        <div className="mb-[22px] animate-wz-fade-in">
          <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-muted mb-[10px]">
            Fecha
          </p>
          <div className="flex gap-[7px] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableDates.map((d, idx) => {
              const dObj = new Date(`${d}T00:00:00.000Z`)
              const dow = DOW_LABELS[dObj.getUTCDay()]
              const day = dObj.getUTCDate()
              const isActive = date === d
              const isToday = idx === 0 && !isActive
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDateChange(d)}
                  className={`shrink-0 flex flex-col items-center gap-[2px] min-w-[46px] px-[6px] py-2
                              rounded-xl border cursor-pointer transition-all duration-[130ms]
                              ${
                                isActive
                                  ? 'bg-accent border-accent'
                                  : isToday
                                    ? 'border-accent/45 bg-accent/6 hover:border-border-hover'
                                    : 'border-border bg-card hover:border-border-hover'
                              }`}
                >
                  <span
                    className={`text-[9px] font-bold uppercase tracking-[0.6px]
                                    ${isActive ? 'text-accent-text' : isToday ? 'text-accent' : 'text-muted'}`}
                  >
                    {idx === 0 ? 'Hoy' : dow}
                  </span>
                  <span
                    className={`text-[17px] font-extrabold leading-none
                                    ${isActive ? 'text-accent-text' : 'text-text'}`}
                  >
                    {day}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      {courtId && date && (
        <div className="mb-[22px] animate-wz-fade-in">
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
      )}

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

      <div className="pt-[10px]">
        <button
          type="button"
          onClick={onNext}
          disabled={!courtId || !date || !startTime}
          className="w-full px-5 py-[13px] rounded-xl bg-accent text-accent-text text-[13px] font-bold
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
