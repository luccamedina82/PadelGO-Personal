import { minutesToTime, timeToMinutes } from '@/lib/availability'

function fmtDur(d: number) {
  return d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}min`
}

const FALLBACK_DURATIONS: number[] = [60, 90, 120]

interface BookingDetailEditSectionProps {
  editStartTime: string
  editDuration: number
  editName: string
  editPhone: string
  source: string
  closeTimeMinutes?: number
  openTimeMinutes?: number
  adminAllowedDurations?: number[]
  onStartTimeChange: (v: string) => void
  onDurationChange: (v: number) => void
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
}

export default function BookingDetailEditSection({
  editStartTime,
  editDuration,
  editName,
  editPhone,
  source,
  closeTimeMinutes,
  openTimeMinutes,
  adminAllowedDurations,
  onStartTimeChange,
  onDurationChange,
  onNameChange,
  onPhoneChange,
}: BookingDetailEditSectionProps) {
  const allDurations = adminAllowedDurations ?? FALLBACK_DURATIONS

  const maxStartMin = closeTimeMinutes !== undefined ? closeTimeMinutes - 60 : 22 * 60
  const minStartMin = openTimeMinutes !== undefined ? openTimeMinutes : 7 * 60
  const timeOptions: string[] = []
  for (let m = minStartMin; m <= maxStartMin; m += 30) {
    timeOptions.push(minutesToTime(m))
  }

  const startMin = editStartTime ? timeToMinutes(editStartTime) : 0
  const availableDurations = allDurations.filter(
    (d) => closeTimeMinutes === undefined || startMin + d <= closeTimeMinutes
  )
  const durationOptions = availableDurations.includes(editDuration)
    ? availableDurations
    : [...availableDurations, editDuration].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-4">
      {/* Time */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Hora de inicio</span>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1 -mx-1 px-1">
          {timeOptions.map((t) => {
            const isSelected = t === editStartTime
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onStartTimeChange(t)
                  if (closeTimeMinutes !== undefined) {
                    const newMin = timeToMinutes(t)
                    if (newMin + editDuration > closeTimeMinutes) {
                      const maxFit = allDurations.filter((d) => newMin + d <= closeTimeMinutes)
                      if (maxFit.length > 0) onDurationChange(maxFit[maxFit.length - 1]!)
                    }
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-mono border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-accent border-accent text-accent-text font-bold'
                    : 'border-border text-muted hover:border-border-hover hover:text-text bg-surface'
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Duración</span>
        <div className="flex gap-2 flex-wrap">
          {durationOptions.map((d) => {
            const isSelected = d === editDuration
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDurationChange(d)}
                className={`px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all active:scale-[.97] ${
                  isSelected
                    ? 'bg-accent border-accent text-accent-text'
                    : 'border-border text-muted hover:border-border-hover hover:text-text bg-surface'
                }`}
              >
                {fmtDur(d)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Name + Phone (MANUAL_STAFF only) */}
      {source === 'MANUAL_STAFF' && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Nombre del cliente</span>
            <input
              type="text"
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2.5 text-[13px] text-text focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Teléfono</span>
            <input
              type="text"
              value={editPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="Opcional"
              className="bg-card border border-border rounded-xl px-3 py-2.5 text-[13px] text-text focus:outline-none focus:border-accent transition-colors placeholder:text-muted/50"
            />
          </div>
        </>
      )}
    </div>
  )
}
