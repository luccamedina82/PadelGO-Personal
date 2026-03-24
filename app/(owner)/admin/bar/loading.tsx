import Skeleton from '@/components/ui/skeleton'

export default function BarLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-52 mb-2" />
        <Skeleton className="h-3 w-40" />
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-2.5">
                  <Skeleton className="h-6 w-6 mx-auto mb-2 rounded-full" />
                  <Skeleton className="h-3 w-16 mx-auto mb-1" />
                  <Skeleton className="h-2.5 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-72 shrink-0 bg-card border border-border rounded-xl p-4">
            <Skeleton className="h-4 w-16 mb-3" />
            <div className="space-y-2 mb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-px w-full mb-3" />
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="grid grid-cols-3 gap-1 mb-3">
              <Skeleton className="h-7 w-full rounded-lg" />
              <Skeleton className="h-7 w-full rounded-lg" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
