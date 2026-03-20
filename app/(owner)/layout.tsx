import AdminSidebar from '@/components/layout/AdminSidebar'
import BottomNav from '@/components/layout/BottomNav'
import { getAdminContext } from '@/lib/dal/admin'
import { Suspense } from 'react'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Cargando...</div>}>
      <ProtectedAdminContent>{children}</ProtectedAdminContent>
    </Suspense>
  )
}

async function ProtectedAdminContent({children}: { children: React.ReactNode }) {
    // Guard: OWNER or STAFF only
  const {session, hasClub} = await getAdminContext(['OWNER', 'STAFF'])

  if (!hasClub) {
    return (
      <div className="p-8 text-center text-muted">
        No tenés ningún club asignado.{' '}
        {session.role === 'OWNER' && <span>Contactá a soporte para configurar tu club.</span>}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={session.role} />
      <main className="flex-1 md:ml-[210px] pb-16 md:pb-0 min-w-0">{children}</main>
      <BottomNav />
    </div>
  )
}

