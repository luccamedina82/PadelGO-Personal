import { requireRole } from '@/actions/auth'
import AdminSidebar from '@/components/layout/AdminSidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Suspense } from 'react'

async function OwnerLayoutContent({ children }: { children: React.ReactNode }) {
  // Guard: OWNER or STAFF only
  const session = await requireRole(['OWNER', 'STAFF'])

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={session.role} />
      <main className="flex-1 md:ml-[210px] pb-16 md:pb-0 min-w-0">{children}</main>
      <BottomNav />
    </div>
  )
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <OwnerLayoutContent>{children}</OwnerLayoutContent>
    </Suspense>
  )
}
