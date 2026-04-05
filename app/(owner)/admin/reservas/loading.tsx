import { Skeleton } from '@/components/ui/skeleton'

// Shows while getAdminContext resolves (~50-200ms).
// Matches the BookingsHeader layout exactly so the transition is seamless.
export default function ReservasLoading() {
  return (
    <div className="h-screen bg-bg flex flex-col">
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
    </div>
  )
}
