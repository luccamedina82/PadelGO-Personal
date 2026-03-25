import AdminSidebar from '@/components/layout/AdminSidebar'
import AdminMain from '@/components/layout/AdminMain'
import BottomNav from '@/components/layout/BottomNav'
import QueryProvider from '@/components/providers/QueryProvider'
import { getAdminContext } from '@/lib/dal/admin'
import { Suspense } from 'react'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-bg">
          <p className="text-muted animate-pulse">Verificando acceso...</p>
        </div>
      }>
        <ProtectedAdminContent>{children}</ProtectedAdminContent>
      </Suspense>
    </div>
  )
}

async function ProtectedAdminContent({ children }: { children: React.ReactNode }) {
  const { session, hasClub } = await getAdminContext(['OWNER', 'STAFF'])

  if (!hasClub) {
    return (
      <div className="p-8 text-center text-muted w-full">
        No tenés ningún club asignado.{' '}
        {session.role === 'OWNER' && <span>Contactá a soporte para configurar tu club.</span>}
      </div>
    )
  }

  return (
    <QueryProvider>
      <AdminSidebar role={session.role} />
      <AdminMain>{children}</AdminMain>
      <BottomNav />
    </QueryProvider>
  )
}