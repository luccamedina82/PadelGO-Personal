import { minutesToTime, timeToMinutes } from '@/lib/availability'

const ALL_DURATIONS: number[] = [60, 90, 120]

interface BookingDetailEditSectionProps {
  editStartTime: string
  editDuration: number
  editName: string
  editPhone: string
  source: string
  closeTimeMinutes?: number
  openTimeMinutes?: number
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
  onStartTimeChange,
  onDurationChange,
  onNameChange,
  onPhoneChange,
}: BookingDetailEditSectionProps) {
  // Bounds: start where at least 60 min fits before close, no earlier than openTime
  const maxStartMin = closeTimeMinutes !== undefined ? closeTimeMinutes - 60 : 22 * 60
  const minStartMin = openTimeMinutes !== undefined ? openTimeMinutes : 7 * 60
  const timeOptions: string[] = []
  for (let m = minStartMin; m <= maxStartMin; m += 30) {
    timeOptions.push(minutesToTime(m))
  }

  const startMin = editStartTime ? timeToMinutes(editStartTime) : 0
  const availableDurations = ALL_DURATIONS.filter(
    (d) => closeTimeMinutes === undefined || startMin + d <= closeTimeMinutes
  )
  // Always keep current duration visible (legacy bookings that predate closeTime enforcement)
  const durationOptions = availableDurations.includes(editDuration)
    ? availableDurations
    : [...availableDurations, editDuration].sort((a, b) => a - b)

  return (
    <div className="space-y-3 mb-5">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Hora de inicio</label>
        <select
          value={editStartTime}
          onChange={(e) => {
            const newTime = e.target.value
            onStartTimeChange(newTime)
            // Auto-correct duration if it no longer fits
            if (closeTimeMinutes !== undefined) {
              const newStartMin = timeToMinutes(newTime)
              if (newStartMin + editDuration > closeTimeMinutes) {
                const maxFit = ALL_DURATIONS.filter(d => newStartMin + d <= closeTimeMinutes)
                if (maxFit.length > 0) onDurationChange(maxFit[maxFit.length - 1])
              }
            }
          }}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          {timeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Duración</label>
        <select
          value={editDuration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          {durationOptions.map((d) => (
            <option key={d} value={d}>{d === 60 ? '60 min' : d === 90 ? '90 min' : '120 min'}</option>
          ))}
        </select>
      </div>
      {source === 'MANUAL_STAFF' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Nombre del cliente</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Teléfono</label>
            <input
              type="text"
              value={editPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="Opcional"
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent placeholder:text-muted/50"
            />
          </div>
        </>
      )}
    </div>
  )
}
