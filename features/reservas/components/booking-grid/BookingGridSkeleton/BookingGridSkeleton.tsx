import { Skeleton } from '@/components/ui/skeleton'
import { SLOT_HEIGHT, TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import type { CourtColumn } from '../types/bookingGrid.types'

interface BookingGridSkeletonProps {
  courts: CourtColumn[]
  gridStart: number
  gridEnd: number
}

export default function BookingGridSkeleton({ courts, gridStart, gridEnd }: BookingGridSkeletonProps) {
  const totalSlots = (gridEnd - gridStart) / 30
  // Show at most 18 rows (~9 hours) so the skeleton fills the viewport without overflowing
  const visibleRows = Math.min(totalSlots, 18)

  return (
    <div className="flex flex-col h-full">
      {/* Header row — mirrors BookingGridHeader */}
      <div className="flex shrink-0 sticky top-0 z-30 bg-surface border-b-2 border-border-hover">
        <div
          style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
          className="shrink-0 border-r border-border"
        />
        {courts.map((court) => (
          <div
            key={court.id}
            className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 border-l border-border"
          >
            <Skeleton className="h-3 w-14 mb-1.5" />
            <div className="w-8 h-0.5 rounded-full bg-surface" />
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex overflow-hidden">
        {/* Time column */}
        <div
          style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
          className="shrink-0 border-r border-border"
        >
          {Array.from({ length: visibleRows }, (_, i) => {
            const isHour = i % 2 === 0
            return (
              <div
                key={i}
                className={`flex items-start justify-end pr-2 ${isHour ? 'border-b border-border-hover' : 'border-b border-border/40'}`}
                style={{ height: SLOT_HEIGHT }}
              >
                {isHour && <Skeleton className="h-2.5 w-8 mt-2" />}
              </div>
            )
          })}
        </div>

        {/* Court columns */}
        {courts.map((court) => (
          <div
            key={court.id}
            className="flex-1 border-l border-border"
          >
            {Array.from({ length: visibleRows }, (_, i) => {
              const isHour = i % 2 === 0
              // Sprinkle a few skeleton booking blocks for realism
              const hasBlock = court.isActive && (i === 2 || i === 6 || i === 10)
              return (
                <div
                  key={i}
                  className={`relative ${isHour ? 'border-b border-border-hover bg-(--grid-row-alt)' : 'border-b border-border/40'}`}
                  style={{ height: SLOT_HEIGHT }}
                >
                  {hasBlock && (
                    <Skeleton className="absolute inset-x-1 rounded-lg" style={{ top: 3, height: SLOT_HEIGHT * 2 - 6 }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
