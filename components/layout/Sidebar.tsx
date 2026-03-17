// Server Component — Player sidebar (desktop only, hidden on mobile)
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import SidebarNavItems from './SidebarNavItems'
import Avatar from '@/components/ui/Avatar'
import { getSession, logout } from '@/actions/auth'
import prisma from '@/lib/prisma'

export default async function Sidebar() {
  const session = await getSession()

  let sidebarUser: { name: string; avatarColor: string; zone: string } | null = null
  if (session) {
    const user = await prisma.user.findUnique({
      where:  { id: session.userId },
      select: { name: true, avatarColor: true, zone: true },
    })
    sidebarUser = user ?? null
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[210px] flex-col bg-surface border-r border-border z-40">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-2xl tracking-widest text-accent">PADELGO</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <SidebarNavItems />
      </nav>

      {/* Footer: user info + theme toggle + logout */}
      <div className="px-4 py-4 border-t border-border space-y-3">
        {/* User identity */}
        {sidebarUser && (
          <Link href="/perfil" className="flex items-center gap-2.5 group">
            <Avatar
              name={sidebarUser.name}
              color={sidebarUser.avatarColor}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text truncate group-hover:text-accent transition-colors">
                {sidebarUser.name.split(' ')[0]}
              </p>
              <p className="text-[10px] text-muted truncate">{sidebarUser.zone}</p>
            </div>
          </Link>
        )}

        {/* Theme toggle row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-sub">Tema</span>
          <ThemeToggle />
        </div>

        {/* Logout */}
        {session && (
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left text-xs text-muted hover:text-red-400 transition-colors py-0.5"
            >
              Cerrar sesión →
            </button>
          </form>
        )}
      </div>
    </aside>
  )
}
