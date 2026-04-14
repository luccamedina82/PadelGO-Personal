import { COURT_COLORS, TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

interface BookingGridHeaderProps {
  courts: CourtColumn[]       // original full list — used for stable color index
  visibleCourts: CourtColumn[]
  colWidth: number
}

export default function BookingGridHeader({ courts, visibleCourts, colWidth }: BookingGridHeaderProps) {
  return (
    <div className="flex sticky top-0 z-50 bg-surface border-b-2 border-border-hover">
      <div
        style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
        className="shrink-0 border-r border-border"
      />
      {visibleCourts.map((court) => {
        const originalIdx = courts.findIndex((c) => c.id === court.id)
        const color = COURT_COLORS[(originalIdx >= 0 ? originalIdx : 0) % COURT_COLORS.length]!
        const isAlt = (originalIdx >= 0 ? originalIdx : 0) % 2 === 1
        return (
          <div
            key={court.id}
            style={{
              width: colWidth,
              minWidth: colWidth,
              background: isAlt ? 'var(--grid-col-alt)' : undefined,
            }}
            className={`flex flex-col items-center justify-center py-2.5 px-2
                        border-l border-border transition-colors
                        ${!court.isActive ? 'opacity-40' : ''}`}
          >
            <p className="text-sm font-bold text-text tracking-wide truncate">{court.name}</p>
            <div
              className="mt-1.5 rounded-full"
              style={{
                width: 28,
                height: 2,
                background: court.isActive ? color.bar : 'var(--border)',
                opacity: court.isActive ? 0.8 : 0.3,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
