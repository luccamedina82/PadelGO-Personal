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
      {/* Slot rows (con opacidad para horas pasadas) */}
      {Array.from({ length: totalSlots }, (_, i) => {
        const mins = gridStart + i * 30
        const isHour = mins % 60 === 0
        const isPast = isViewingPast || (currentMinutes !== null && mins < currentMinutes)
        return (
          <div
            key={i}
            className={`absolute left-0 right-0
                        ${isPast ? 'opacity-35' : ''}
                        ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}`}
            style={{
              top: i * slotHeight,
              height: slotHeight,
              background: isHour ? 'var(--grid-row-alt)' : 'transparent',
            }}
          />
        )
      })}

      {/* Labels de hora — capa separada para que nunca hereden opacity */}
      {Array.from({ length: totalSlots + 1 }, (_, i) => {
        const mins = gridStart + i * 30
        if (mins % 60 !== 0) return null
        const isFirst = i === 0
        const isLast = i === totalSlots
        const transform = isFirst ? 'translateY(1px)' : isLast ? 'translateY(calc(-100% - 1px))' : 'translateY(-50%)'
        return (
          <span
            key={`label-${i}`}
            className="absolute right-2 text-[11px] font-mono text-muted leading-none pointer-events-none px-0.5"
            style={{ top: i * slotHeight, transform, background: 'var(--bg)' }}
          >
            {minutesToTime(mins % 1440)}
          </span>
        )
      })}
    </div>
  )
}
