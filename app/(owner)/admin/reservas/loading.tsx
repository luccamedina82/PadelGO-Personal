import { Skeleton } from '@/components/ui/skeleton'
import BookingGridSkeleton from '@/features/reservas/components/booking-grid/BookingGridSkeleton/BookingGridSkeleton'
import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

const FALLBACK_COURTS: CourtColumn[] = [
  { id: '1', name: '', isActive: true },
  { id: '2', name: '', isActive: true },
  { id: '3', name: '', isActive: true },
]

// Shows while getAdminContext resolves (~50-200ms).
// Mirrors the full page layout so nothing jumps when the real content streams in.
export default function ReservasLoading() {
  return (
    <div className="h-screen bg-bg flex flex-col">
      {/* BookingsHeader skeleton */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border">
        <div className="pl-4 pr-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
            <div className="min-w-[240px] flex justify-center px-1">
              <Skeleton className="h-[26px] w-52 rounded-md" />
            </div>
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
            <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          </div>
          <div className="flex-1" />
          <Skeleton className="shrink-0 h-10 w-[152px] rounded-xl" />
        </div>
      </div>

      {/* Grid skeleton — same fallback values as the Suspense in page.tsx */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <BookingGridSkeleton courts={FALLBACK_COURTS} gridStart={8 * 60} gridEnd={22 * 60} />
      </div>
    </div>
  )
}
