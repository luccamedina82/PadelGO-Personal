import Skeleton from '@/components/ui/skeleton'

export default function ConfigLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-56 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-5">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Skeleton className="h-4 w-44 mb-3" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ))}

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-60" />
          <div className="bg-bg rounded-lg p-3 border border-border space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>

        <div className="bg-card border border-red-400/20 rounded-xl p-4">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  )
}
