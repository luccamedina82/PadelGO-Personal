import { Skeleton } from '@/components/ui/skeleton'
import { SLOT_HEIGHT, TIME_COL_WIDTH } from '@/features/reservas/components/booking-grid/helpers/bookingGrid.helpers'

// Placeholder court count used when real data isn't available yet.
// Most padel clubs have 2-4 courts; 3 gives a balanced skeleton.
const SKELETON_COURTS = 3
const SKELETON_ROWS = 18 // ~9 hours visible

export default function ReservasLoading() {
  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* ── Sticky header — mirrors BookingsClient header exactly ────────── */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border">
        <div className="pl-4 pr-4 py-2.5 flex items-center gap-3">
          {/* DateHeader skeleton */}
          <div className="flex items-center gap-1">
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
            <div className="min-w-[240px] flex justify-center px-1">
              <Skeleton className="h-[26px] w-52 rounded-md" />
            </div>
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          </div>
          <div className="flex-1" />
          {/* NuevaReservaButton skeleton */}
          <Skeleton className="shrink-0 h-10 w-[152px] rounded-xl" />
        </div>
      </div>

      {/* ── Progress bar placeholder (keeps layout stable) ──────────────── */}
      <div className="h-0.5" />

      {/* ── Grid skeleton ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-col h-full">
          {/* Header row */}
          <div className="flex shrink-0 sticky top-0 z-30 bg-surface border-b-2 border-border-hover">
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              className="shrink-0 border-r border-border"
            />
            {Array.from({ length: SKELETON_COURTS }).map((_, i) => (
              <div
                key={i}
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
              {Array.from({ length: SKELETON_ROWS }, (_, i) => {
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
            {Array.from({ length: SKELETON_COURTS }).map((_, col) => (
              <div key={col} className="flex-1 border-l border-border">
                {Array.from({ length: SKELETON_ROWS }, (_, i) => {
                  const isHour = i % 2 === 0
                  const hasBlock = (col === 0 && i === 2) || (col === 1 && i === 6) || (col === 2 && i === 4)
                  return (
                    <div
                      key={i}
                      className={`relative ${isHour ? 'border-b border-border-hover bg-(--grid-row-alt)' : 'border-b border-border/40'}`}
                      style={{ height: SLOT_HEIGHT }}
                    >
                      {hasBlock && (
                        <Skeleton
                          className="absolute inset-x-1 rounded-lg"
                          style={{ top: 3, height: SLOT_HEIGHT * 2 - 6 }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
