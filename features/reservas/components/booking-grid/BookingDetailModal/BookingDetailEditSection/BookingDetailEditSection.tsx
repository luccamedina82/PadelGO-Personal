import { minutesToTime } from '../../helpers/bookingGrid.helpers'

interface BookingDetailEditSectionProps {
  editStartTime: string
  editDuration: number
  editName: string
  editPhone: string
  source: string
  onStartTimeChange: (v: string) => void
  onDurationChange: (v: number) => void
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
}

const timeOptions: string[] = []
for (let m = 7 * 60; m <= 22 * 60; m += 30) {
  timeOptions.push(minutesToTime(m))
}

export default function BookingDetailEditSection({
  editStartTime,
  editDuration,
  editName,
  editPhone,
  source,
  onStartTimeChange,
  onDurationChange,
  onNameChange,
  onPhoneChange,
}: BookingDetailEditSectionProps) {
  return (
    <div className="space-y-3 mb-5">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted">Hora de inicio</label>
        <select
          value={editStartTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
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
          <option value={60}>60 min</option>
          <option value={90}>90 min</option>
          <option value={120}>120 min</option>
        </select>
      </div>
      {source === 'MANUAL_OWNER' && (
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
