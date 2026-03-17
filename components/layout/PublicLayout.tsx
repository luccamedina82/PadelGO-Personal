import Navbar from './Navbar'
import BottomNav from './BottomNav'

/**
 * PublicLayout — shared layout for public pages (/, /buscar, /club/[id]).
 * Renders Navbar + BottomNav without requiring authentication.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0 min-w-0">{children}</main>
      <BottomNav />
    </div>
  )
}
