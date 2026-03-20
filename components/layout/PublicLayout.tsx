import Navbar from './Navbar'
import BottomNav from './BottomNav'
import { Suspense } from 'react'

/**
 * PublicLayout — shared layout for public pages (/, /buscar, /club/[id]).
 * Renders Navbar + BottomNav without requiring authentication.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          // Este fallback es un "cascarón" vacío del mismo alto que tu Navbar (ej: 64px o h-16)
          // para que la página no pegue un salto visual mientras lee la cookie.
          <header className="h-16 w-full border-b border-white/10 bg-surface animate-pulse" />
        }
      >
        <Navbar />
      </Suspense>
      <main className="flex-1 pb-16 md:pb-0 min-w-0">{children}</main>
      <BottomNav />
    </div>
  )
}
