'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import Avatar from '@/components/ui/Avatar'
import ThemeToggle from './ThemeToggle'
import { logout } from '@/actions/auth'
import type { JwtSession } from '@/types'

interface NavbarUser {
  name: string
  avatarColor: string
  zone: string
  level: number
}

interface NavbarClientProps {
  session: JwtSession | null
  user: NavbarUser | null
}

// Nav links for logged-in players
const AUTH_NAV = [
  { href: '/', label: 'Inicio', exact: true },
  { href: '/buscar', label: 'Reservar', exact: false },
  { href: '/ranking', label: 'Ranking', exact: false },
  { href: '/open-match', label: 'Open Match', exact: false },
]

// Nav links for guests
const GUEST_NAV = [
  { href: '/', label: 'Inicio', exact: true },
  { href: '/buscar', label: 'Reservar', exact: false },
]

export default function NavbarClient({ session, user }: NavbarClientProps) {
  const pathname = usePathname()
  const [ddOpen, setDdOpen] = useState(false)
  const ddRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!ddOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setDdOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [ddOpen])

  const navItems = session ? AUTH_NAV : GUEST_NAV
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <header
      className="sticky top-0 z-[200] h-16 border-b border-border"
      style={{
        backgroundColor: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div className="h-full max-w-[1360px] mx-auto flex items-center justify-between px-4 md:px-10">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <span className="font-display text-[26px] tracking-[3px]">
            <span className="text-accent">PADEL</span><span className="text-text">GO</span>
          </span>
        </Link>

        {/* Center nav links (desktop only) */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'px-3.5 py-2 rounded-[10px] text-[13px] font-medium transition-colors',
                  isActive
                    ? 'text-accent bg-tag font-bold'
                    : 'text-muted hover:text-text hover:bg-card'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle — always visible */}
          <ThemeToggle />

          {session && user ? (
            /* User chip + dropdown */
            <div className="relative" ref={ddRef}>
              <button
                type="button"
                onClick={() => setDdOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border pl-3 pr-2 py-[5px] text-sm font-medium text-text hover:border-accent transition-colors"
              >
                <span className="hidden sm:inline">{firstName}</span>
                <Avatar name={user.name} color={user.avatarColor} size="xs" />
                {/* Chevron */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={clsx('text-sub transition-transform', ddOpen && 'rotate-180')}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Dropdown */}
              {ddOpen && (
                <div className="absolute top-[calc(100%+10px)] right-0 min-w-[210px] bg-card border border-border-hover rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden animate-fadeIn z-50">
                  {/* Mini profile card */}
                  <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                    <Avatar name={user.name} color={user.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{user.name}</p>
                      <p className="text-[11px] text-muted truncate">
                        Nivel {user.level} · {user.zone}
                      </p>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="py-1">
                    <Link
                      href="/perfil"
                      onClick={() => setDdOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition-colors"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Mi perfil
                    </Link>
                    <Link
                      href="/historial"
                      onClick={() => setDdOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition-colors"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" x2="8" y1="13" y2="13" />
                        <line x1="16" x2="8" y1="17" y2="17" />
                      </svg>
                      Historial
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-border py-1">
                    <form action={logout}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-surface transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                        Cerrar sesión
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Guest: Login + Register */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-[10px] text-sm font-medium text-muted hover:text-text transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="px-4 py-1.5 rounded-[10px] text-sm font-semibold bg-accent text-accent-text hover:bg-accent-dark transition-colors"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
