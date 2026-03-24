import Skeleton from '@/components/ui/skeleton'

export default function EquipoLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <div>
          <Skeleton className="h-5 w-44 mb-2" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-3 w-56" />
        </div>

        <div>
          <Skeleton className="h-4 w-28 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-1.5" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-40 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
