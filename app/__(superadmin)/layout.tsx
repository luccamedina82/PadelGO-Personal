import { requireSuperAdmin } from '@/actions/auth'
import SuperadminSidebar from '@/components/layout/SuperadminSidebar'
import { Suspense } from 'react'

async function SuperadminLayoutContent({ children }: { children: React.ReactNode }) {
  // Guard: SUPERADMIN only
  await requireSuperAdmin()

  return (
    <div className="flex min-h-screen">
      <SuperadminSidebar />
      <main className="flex-1 md:ml-[210px] min-w-0">{children}</main>
    </div>
  )
}

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <SuperadminLayoutContent>{children}</SuperadminLayoutContent>
    </Suspense>
  )
}
