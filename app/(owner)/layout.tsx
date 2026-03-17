import { requireRole } from '@/actions/auth'
import AdminSidebar from '@/components/layout/AdminSidebar'
import BottomNav from '@/components/layout/BottomNav'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
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
