const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface ManualBookingWizardStep1Props {
  date: string
  setDate(v: string): void
  availableDates: string[]
  onNext(): void
}

export default function ManualBookingWizardStep1({
  date,
  setDate,
  availableDates,
  onNext,
}: ManualBookingWizardStep1Props) {
  return (
    <div className="flex flex-col">
      <div className="mb-[22px]">
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
                onClick={() => setDate(d)}
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

      <div className="pt-[10px]">
        <button
          type="button"
          onClick={onNext}
          disabled={!date}
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
