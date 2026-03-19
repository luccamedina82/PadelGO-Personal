import Skeleton from '@/components/ui/Skeleton'

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Skeleton className="h-10 w-44 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg space-y-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full mt-2" />
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>

        <Skeleton className="h-4 w-28 mx-auto" />
      </div>
    </div>
  )
}
