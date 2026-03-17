import { requireSuperAdmin } from '@/actions/auth'
import SuperadminSidebar from '@/components/layout/SuperadminSidebar'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  // Guard: SUPERADMIN only
  await requireSuperAdmin()

  return (
    <div className="flex min-h-screen">
      <SuperadminSidebar />
      <main className="flex-1 md:ml-[210px] min-w-0">{children}</main>
    </div>
  )
}
