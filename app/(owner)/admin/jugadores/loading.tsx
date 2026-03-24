import Skeleton from '@/components/ui/skeleton'

export default function JugadoresLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 pt-4 pb-4">
        <Skeleton className="h-8 w-44 mb-2" />
        <Skeleton className="h-3 w-36" />
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-full rounded-xl mb-4" />
        <Skeleton className="h-3 w-40 mb-3" />

        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 min-w-0">
                  <Skeleton className="h-4 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <div className="text-right hidden sm:block">
                  <Skeleton className="h-4 w-10 mb-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
