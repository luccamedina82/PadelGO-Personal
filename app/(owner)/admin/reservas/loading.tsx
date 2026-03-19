import Skeleton from '@/components/ui/Skeleton'

export default function ReservasLoading() {
  return (
    <div className="h-screen bg-bg flex flex-col">
      <div className="sticky top-0 z-20 bg-surface border-b border-border">
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>

        <div className="overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-12 rounded-xl shrink-0" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-5 overflow-hidden">
        <div className="h-full rounded-2xl border border-border bg-card/80 p-4">
          <div className="grid grid-cols-5 gap-3 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, row) => (
              <div key={row} className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((__, col) => (
                  <Skeleton key={col} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
