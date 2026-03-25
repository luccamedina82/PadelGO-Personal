'use client'

import type { BookingBlock, CourtColumn } from '../booking-grid/types/bookingGrid.types'

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const endMin = (h ?? 0) * 60 + (m ?? 0) + durationMinutes
  return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
}

interface CourtStatusPanelProps {
  courts: CourtColumn[]
  occupiedCourtIds: Set<string>
  bookings: BookingBlock[]
  nowMinutes: number
}

export default function CourtStatusPanel({
  courts,
  occupiedCourtIds,
  bookings,
  nowMinutes,
}: CourtStatusPanelProps) {
  const freeCourtsCount = courts.length - occupiedCourtIds.size

  return (
    <div className="w-52 xl:w-60 shrink-0 flex flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className="shrink-0">
        <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted">
          Estado canchas
        </h2>
        <p className="text-xs text-sub mt-0.5">
          {freeCourtsCount === courts.length
            ? 'Todas libres'
            : freeCourtsCount === 0
            ? 'Todas ocupadas'
            : `${freeCourtsCount} libre${freeCourtsCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Court rectangles */}
      <div className="space-y-2">
        {courts.map((court) => {
          const isOccupied = occupiedCourtIds.has(court.id)
          const currentBooking = bookings.find((b) => {
            const [h, m] = b.startTime.split(':').map(Number)
            const start = (h ?? 0) * 60 + (m ?? 0)
            return (
              b.courtId === court.id &&
              start <= nowMinutes &&
              start + b.durationMinutes > nowMinutes
            )
          })

          return (
            <div
              key={court.id}
              className={`rounded-xl p-3 border transition-all ${
                isOccupied
                  ? 'bg-red-500/8 border-red-500/25'
                  : 'bg-green-500/8 border-green-500/25'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-text truncate pr-2">{court.name}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isOccupied ? 'bg-red-400' : 'bg-green-400'
                  }`}
                />
              </div>
              {isOccupied && currentBooking ? (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted truncate">{currentBooking.displayName}</p>
                  <p className="text-[11px] text-red-400/80 tabular-nums">
                    hasta {getEndTime(currentBooking.startTime, currentBooking.durationMinutes)}
                  </p>
                </div>
              ) : (
                <p className="text-xs font-medium text-green-400">Libre</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
