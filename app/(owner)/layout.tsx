import AdminSidebar from '@/components/layout/AdminSidebar'
import BottomNav from '@/components/layout/BottomNav'
import QueryProvider from '@/components/providers/QueryProvider'
import { getAdminContext } from '@/lib/dal/admin'
import { Suspense } from 'react' // 1. Importamos Suspense

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
      <main className="flex-1 md:ml-[210px] pb-16 md:pb-0 min-w-0">
        {children}
      </main>
      <BottomNav />
    </QueryProvider>
  )
}