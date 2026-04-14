import Skeleton from '@/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-bg p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <div className="mb-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-9 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="mb-4 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end" style={{ height: 40 }}>
                <Skeleton className="h-10 w-full rounded-t" />
              </div>
              <Skeleton className="h-2 w-4" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-32 mt-3" />
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-32 mt-3" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <Skeleton className="h-5 w-48 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
