import { TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

interface BookingGridHeaderProps {
  visibleCourts: CourtColumn[]
  colWidth: number
}

export default function BookingGridHeader({ visibleCourts, colWidth }: BookingGridHeaderProps) {
  return (
    <div className="flex sticky top-0 z-30 bg-surface border-b-2 border-border-hover">
      <div
        style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
        className="shrink-0 border-r border-border"
      />
      {visibleCourts.map((court, courtIndex) => (
        <div
          key={court.id}
          style={{ width: colWidth, minWidth: colWidth, background: courtIndex % 2 === 1 ? 'var(--grid-col-alt)' : undefined }}
          className={`flex flex-col items-center justify-center py-2.5 px-2
                      border-l border-border transition-colors
                      ${!court.isActive ? 'opacity-40' : ''}`}
        >
          <p className="text-xs font-bold text-text tracking-wide truncate">{court.name}</p>
          {court.isActive && (
            <div className="mt-1.5 w-8 h-0.5 rounded-full bg-accent opacity-60" />
          )}
        </div>
      ))}
    </div>
  )
}
