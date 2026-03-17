import { requireAuth } from '@/actions/auth'
import Navbar from '@/components/layout/Navbar'
import BottomNav from '@/components/layout/BottomNav'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Guard: redirect to /login if not authenticated
  await requireAuth()

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0 min-w-0">{children}</main>
      <BottomNav />
    </div>
  )
}
