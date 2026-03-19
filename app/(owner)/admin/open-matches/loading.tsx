import Skeleton from '@/components/ui/Skeleton'

export default function OpenMatchesLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <div>
          <Skeleton className="h-5 w-64 mb-2" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-4 w-52 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Skeleton key={j} className="h-6 w-6 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-36 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

