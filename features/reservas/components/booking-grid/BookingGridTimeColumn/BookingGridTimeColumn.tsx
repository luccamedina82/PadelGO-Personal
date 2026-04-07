import { minutesToTime } from '@/lib/availability'
import { TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'

interface BookingGridTimeColumnProps {
  gridStart: number
  gridEnd: number
  currentMinutes: number | null
  isViewingPast: boolean
  slotHeight: number
}

export default function BookingGridTimeColumn({
  gridStart,
  gridEnd,
  currentMinutes,
  isViewingPast,
  slotHeight,
}: BookingGridTimeColumnProps) {
  const totalSlots = (gridEnd - gridStart) / 30
  const gridHeight = totalSlots * slotHeight

  return (
    <div
      style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH, height: gridHeight }}
      className="shrink-0 relative border-r border-border bg-bg"
    >
      {Array.from({ length: totalSlots }, (_, i) => {
        const mins = gridStart + i * 30
        const isHour = mins % 60 === 0
        const label = isHour ? minutesToTime(mins) : ''
        const isPast = isViewingPast || (currentMinutes !== null && mins < currentMinutes)
        return (
          <div
            key={i}
            className={`absolute left-0 right-0 flex items-start justify-end pr-2
                        ${isPast ? 'opacity-35' : ''}
                        ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}`}
            style={{
              top: i * slotHeight,
              height: slotHeight,
              background: isHour ? 'var(--grid-row-alt)' : 'transparent',
            }}
          >
            {label && (
              <span className="text-[11px] font-mono text-muted mt-1.5 leading-none">
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
