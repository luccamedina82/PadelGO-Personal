import Skeleton from '@/components/ui/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-24 mb-2" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                {i === 0 && <Skeleton className="h-3 w-12" />}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="space-y-3">
                {i === 1 ? (
                  <div className="flex items-end gap-2 h-32">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div key={j} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full" style={{ height: '100px' }}>
                          <Skeleton className="h-full w-full rounded-t" />
                        </div>
                        <Skeleton className="h-3 w-8 mt-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-full" />
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
