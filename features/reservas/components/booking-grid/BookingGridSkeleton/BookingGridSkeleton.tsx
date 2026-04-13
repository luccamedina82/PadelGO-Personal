import { Skeleton } from '@/components/ui/skeleton'
import { SLOT_HEIGHT, TIME_COL_WIDTH } from '../helpers/bookingGrid.helpers'
import { timeToMinutes } from '@/lib/availability'
import type { CourtColumn } from '../types/bookingGrid.types'

interface SkeletonBooking {
  courtId: string
  startTime: string
  durationMinutes: number
}

interface BookingGridSkeletonProps {
  courts: CourtColumn[]
  gridStart: number
  gridEnd: number
  bookings?: SkeletonBooking[]
}

const FALLBACK_ROWS = [2, 6, 10]

export default function BookingGridSkeleton({ courts, gridStart, gridEnd, bookings }: BookingGridSkeletonProps) {
  const totalSlots = (gridEnd - gridStart) / 30
  const visibleRows = Math.min(totalSlots, 18)

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex shrink-0 sticky top-0 z-30 bg-surface border-b-2 border-border-hover">
        <div
          style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
          className="shrink-0 border-r border-border"
        />
        {courts.map((court, courtIndex) => (
          <div
            key={court.id}
            className="flex-1 flex flex-col items-center justify-center py-2.5 px-2 border-l border-border"
          >
            <Skeleton
              className="h-3 w-14 mb-1.5"
              style={{ animationDelay: `${courtIndex * 80}ms`, animationDuration: '1.1s' }}
            />
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
                {isHour && <Skeleton className="h-2.5 w-8 mt-2" style={{ animationDuration: '2s' }} />}
              </div>
            )
          })}
        </div>

        {/* Court columns */}
        {courts.map((court, courtIndex) => {
          const courtBookings = bookings
            ? bookings.filter((b) => b.courtId === court.id)
            : []

          return (
            <div
              key={court.id}
              className="flex-1 relative border-l border-border"
            >
              {/* Row grid lines */}
              {Array.from({ length: visibleRows }, (_, i) => {
                const isHour = i % 2 === 0
                const rowSlotMin = gridStart + i * 30
                const hasFallbackBlock = !bookings && court.isActive && FALLBACK_ROWS.includes(i)
                return (
                  <div
                    key={i}
                    className={`relative ${isHour ? 'border-b border-border-hover bg-(--grid-row-alt)' : 'border-b border-border/40'}`}
                    style={{ height: SLOT_HEIGHT, animationDelay: `${courtIndex * 0.08 + i * 0.04}s`, animationDuration: '2s' }}
                  >
                    {hasFallbackBlock && (
                      <Skeleton
                        className="absolute inset-x-1 rounded-xl overflow-hidden"
                        style={{ top: 3, height: SLOT_HEIGHT * 2 - 6, animationDuration: '2s', animationDelay: `${courtIndex * 0.08 + i * 0.04}s` }}
                      />
                    )}
                  </div>
                )
              })}

              {/* Real-position booking blocks */}
              {courtBookings.map((b, i) => {
                const topOffset = ((timeToMinutes(b.startTime) - gridStart) / 30) * SLOT_HEIGHT
                const blockHeight = (b.durationMinutes / 30) * SLOT_HEIGHT - 6
                const delay = `${courtIndex * 0.08 + i * 0.04}s`
                return (
                  <div
                    key={i}
                    className="absolute inset-x-1 rounded-xl overflow-hidden bg-surface animate-pulse"
                    style={{ top: topOffset + 3, height: blockHeight, animationDelay: delay, animationDuration: '2s' }}
                  >
                    <div className="flex flex-col gap-1 p-2">
                      <div className="h-2.5 rounded bg-muted/20" style={{ width: '75%' }} />
                      <div className="h-2 rounded bg-muted/15" style={{ width: '55%' }} />
                      <div className="flex gap-1 mt-0.5">
                        <div className="h-2 w-12 rounded bg-muted/15" />
                        <div className="h-2 w-11 rounded bg-muted/15" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
