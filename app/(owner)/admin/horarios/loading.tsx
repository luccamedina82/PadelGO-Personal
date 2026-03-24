import Skeleton from '@/components/ui/skeleton'

export default function HorariosLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <Skeleton className="h-5 w-52 mb-2" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="p-4 space-y-6 max-w-3xl mx-auto pb-16">
        {Array.from({ length: 2 }).map((_, card) => (
          <div key={card} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 7 }).map((__, row) => (
                <div key={row} className="px-4 py-3 flex items-center gap-3">
                  <Skeleton className="h-6 w-11 rounded-full" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
                  <Skeleton className="h-7 w-20 rounded-lg ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
