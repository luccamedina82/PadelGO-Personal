'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toggleClubActive } from '@/actions/superadmin/clubs'

interface SuperadminBannerProps {
  clubId: string
  clubName: string
  zone: string
  courtCount: number
  isActive: boolean
}

export default function SuperadminBanner({
  clubId,
  clubName,
  zone,
  courtCount,
  isActive: initialIsActive,
}: SuperadminBannerProps) {
  const [isActive, setIsActive] = useState(initialIsActive)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleClubActive(clubId)
      if (result.success && result.data) {
        setIsActive(result.data.isActive)
      }
    })
  }

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b"
      style={{
        background: 'rgba(168,85,247,0.12)',
        borderColor: 'rgba(168,85,247,0.3)',
      }}
    >
      {/* Left: context info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span style={{ color: '#a855f7' }}>👁</span>
        <span className="font-medium" style={{ color: '#a855f7' }}>
          Modo soporte
        </span>
        <span className="text-muted">·</span>
        <span className="text-text font-medium truncate">{clubName}</span>
        <span className="text-muted hidden sm:inline">·</span>
        <span className="text-muted text-xs hidden sm:inline">
          {zone} · {courtCount} cancha{courtCount !== 1 ? 's' : ''}
        </span>
        <span className="text-muted">·</span>
        <span
          className={`flex items-center gap-1 text-xs font-medium ${isActive ? 'text-green-400' : 'text-red-400'}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${isActive ? 'bg-green-400' : 'bg-red-400'}`}
          />
          {isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
              : 'border-green-500/40 text-green-400 hover:bg-green-500/10'
          }`}
        >
          {isPending ? '...' : isActive ? 'Desactivar club' : 'Activar club'}
        </button>
        <Link
          href="/superadmin/clubs"
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text hover:bg-card transition-colors"
        >
          ← Salir del contexto
        </Link>
      </div>
    </div>
  )
}
