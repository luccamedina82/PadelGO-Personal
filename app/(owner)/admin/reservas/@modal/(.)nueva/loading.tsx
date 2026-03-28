import Skeleton from '@/components/ui/skeleton'

export default function NuevaReservaModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-bg flex flex-col overflow-hidden"
        style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.50)' }}
      >
        <div className="px-6 py-4 border-b border-border shrink-0">
          <Skeleton className="h-6 w-44" />
        </div>
        <div className="flex-1 p-6 grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-14 rounded-[10px]" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Skeleton className="h-9 w-36 rounded-full" />
              <Skeleton className="h-9 w-36 rounded-full" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl mt-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}
