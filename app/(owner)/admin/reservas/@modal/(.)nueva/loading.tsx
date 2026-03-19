import Skeleton from '@/components/ui/Skeleton'

export default function NuevaReservaModalLoading() {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-110 border-l border-border bg-bg"
        style={{ boxShadow: '-12px 0 40px rgba(0,0,0,0.28)' }}
      >
        <div className="sticky top-0 z-10 px-5 py-4 bg-surface border-b border-border">
          <Skeleton className="h-6 w-44 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
