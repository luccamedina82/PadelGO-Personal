'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import ThemeToggle from './ThemeToggle'
import type { Role } from '@/types'
import { useSidebarStore } from '@/store/sidebarStore'

type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean }

// Items visible to both OWNER and STAFF
const SHARED_ITEMS: NavItem[] = [
  // {
  //   href: '/admin',
  //   label: 'Hoy',
  //   exact: true,
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <rect width="18" height="18" x="3" y="4" rx="2" />
  //       <line x1="16" x2="16" y1="2" y2="6" />
  //       <line x1="8" x2="8" y1="2" y2="6" />
  //       <line x1="3" x2="21" y1="10" y2="10" />
  //       <line x1="8" x2="8" y1="14" y2="18" />
  //       <line x1="12" x2="12" y1="14" y2="18" />
  //     </svg>
  //   ),
  // },
  {
    href: '/admin/reservas',
    label: 'Reservas',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/admin/conflictos',
    label: 'Conflictos',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  // {
  //   href: '/admin/bar',
  //   label: 'Bar',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
  //       <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
  //       <line x1="6" x2="6" y1="2" y2="4" />
  //       <line x1="10" x2="10" y1="2" y2="4" />
  //       <line x1="14" x2="14" y1="2" y2="4" />
  //     </svg>
  //   ),
  // },
  // {
  //   href: '/admin/open-matches',
  //   label: 'Partidos abiertos',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <circle cx="12" cy="12" r="1" />
  //       <circle cx="12" cy="5" r="1" />
  //       <circle cx="5" cy="12" r="1" />
  //       <circle cx="19" cy="12" r="1" />
  //       <circle cx="9" cy="19" r="1" />
  //       <circle cx="15" cy="19" r="1" />
  //     </svg>
  //   ),
  // },
]

// Items visible only to OWNER (C-11)
const OWNER_ONLY_ITEMS: NavItem[] = [
  {
    href: '/admin/canchas',
    label: 'Canchas y Horarios',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <line x1="3" x2="21" y1="12" y2="12" />
        <line x1="12" x2="12" y1="3" y2="21" />
      </svg>
    ),
  },
  // {
  //   href: '/admin/jugadores',
  //   label: 'Jugadores',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <circle cx="9" cy="7" r="4" />
  //       <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  //       <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  //       <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
  //     </svg>
  //   ),
  // },
  // {
  //   href: '/admin/turnos-fijos',
  //   label: 'Turnos fijos',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  //       <path d="m15 5 4 4" />
  //     </svg>
  //   ),
  // },
  // {
  //   href: '/admin/equipo',
  //   label: 'Equipo',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
  //       <circle cx="9" cy="7" r="4" />
  //       <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
  //       <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  //     </svg>
  //   ),
  // },
  {
    href: '/admin/tarifas',
    label: 'Tarifas y Reglas',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="20" height="12" x="2" y="6" rx="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  // {
  //   href: '/admin/analytics',
  //   label: 'Analytics',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <line x1="18" x2="18" y1="20" y2="10" />
  //       <line x1="12" x2="12" y1="20" y2="4" />
  //       <line x1="6" x2="6" y1="20" y2="14" />
  //     </svg>
  //   ),
  // },
  // {
  //   href: '/admin/config',
  //   label: 'Config',
  //   icon: (
  //     <svg
  //       width="18"
  //       height="18"
  //       viewBox="0 0 24 24"
  //       fill="none"
  //       stroke="currentColor"
  //       strokeWidth="1.8"
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     >
  //       <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  //       <circle cx="12" cy="12" r="3" />
  //     </svg>
  //   ),
  // },
]

interface AdminSidebarProps {
  role: Role
}

export default function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarStore()
  const items = role === 'OWNER' ? [...SHARED_ITEMS, ...OWNER_ONLY_ITEMS] : SHARED_ITEMS

  return (
    <aside
      className={clsx(
        'hidden md:flex fixed left-0 top-0 h-full flex-col bg-surface border-r border-border z-40 transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[210px]'
      )}
    >
      {/* Logo + toggle button */}
      <div className={clsx('flex items-center border-b border-border', collapsed ? 'justify-center py-5 px-2' : 'px-5 py-6')}>
        {!collapsed && (
          <Link href="/admin" className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="font-display text-2xl tracking-widest text-accent">PADELGO</span>
            <span className="text-[10px] uppercase tracking-widest text-muted font-medium">
              {role === 'OWNER' ? 'Dashboard Owner' : 'Dashboard Staff'}
            </span>
          </Link>
        )}
        <button
          onClick={toggle}
          className={clsx(
            'flex-shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors',
            collapsed ? 'size-9' : 'size-7 ml-2'
          )}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <><polyline points="9 18 15 12 9 6" /></>
              : <><polyline points="15 18 9 12 15 6" /></>
            }
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className={clsx('flex-1 py-4 overflow-y-auto', collapsed ? 'px-1.5' : 'px-3')}>
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={clsx(
                    'flex items-center rounded-lg text-sm transition-colors',
                    collapsed ? 'justify-center size-9 mx-auto' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-muted hover:text-text hover:bg-card'
                  )}
                >
                  <span
                    className={clsx('flex-shrink-0', isActive ? 'text-accent' : 'text-sub')}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer: home link + theme */}
      <div className={clsx('border-t border-border', collapsed ? 'py-3 flex flex-col items-center gap-3' : 'px-4 py-4 space-y-2')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          {!collapsed && <span className="text-xs text-sub">Tema</span>}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
