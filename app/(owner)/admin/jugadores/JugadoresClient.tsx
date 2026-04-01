'use client'

import { useState } from 'react'

interface PlayerBooking {
  id: string
  date: string
  startTime: string
  durationMinutes: number
  totalPrice: number
  paymentStatus: string
  status: string
  source: string
}

interface Player {
  id: string
  name: string
  email: string
  phone: string | null
  avatarColor: string
  isGhost: boolean
  totalBookings: number
  totalSpent: number
  lastBookingDate: string | null
  lastBookingTime: string | null
  bookings: PlayerBooking[]
}

function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(centavos / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = {
    ONLINE: 'Online',
    MANUAL_STAFF: 'Manual',
    BLOCK: 'Bloqueo',
    MANUAL_SUPPORT: 'Soporte',
  }
  const colorMap: Record<string, string> = {
    ONLINE: 'text-accent bg-accent/10 border-accent/20',
    MANUAL_STAFF: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    BLOCK: 'text-muted bg-muted/10 border-muted/20',
    MANUAL_SUPPORT: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  }
  return (
    <span
      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colorMap[source] ?? colorMap.MANUAL_STAFF}`}
    >
      {map[source] ?? source}
    </span>
  )
}

function PlayerCard({ player }: { player: Player }) {
  const [expanded, setExpanded] = useState(false)

  const payLabel =
    player.totalSpent > 0 ? (
      <span className="text-green-400">{formatPrice(player.totalSpent)}</span>
    ) : (
      <span className="text-muted">$0</span>
    )

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-card-hover transition-colors text-left"
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: player.avatarColor }}
        >
          {initials(player.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">
            {player.name}
            {player.isGhost && (
              <span className="ml-1.5 text-[9px] text-muted font-normal uppercase tracking-wider">
                Guest
              </span>
            )}
          </p>
          <p className="text-xs text-muted truncate">{player.email}</p>
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-text">{player.totalBookings}</p>
          <p className="text-[10px] text-muted">reservas</p>
        </div>
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-sm font-semibold">{payLabel}</p>
          <p className="text-[10px] text-muted">cobrado</p>
        </div>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded: booking history */}
      {expanded && (
        <div className="border-t border-border">
          {/* Contact row */}
          {(player.phone || !player.isGhost) && (
            <div className="px-4 py-2.5 flex gap-4 border-b border-border bg-bg/40">
              {player.phone && (
                <span className="text-xs text-muted">
                  <span className="text-sub">Tel: </span>
                  {player.phone}
                </span>
              )}
              {!player.isGhost && (
                <span className="text-xs text-muted truncate">
                  <span className="text-sub">Email: </span>
                  {player.email}
                </span>
              )}
            </div>
          )}

          {/* Reservas */}
          {player.bookings.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted">Sin historial.</p>
          ) : (
            <div className="divide-y divide-border">
              {player.bookings.map((b) => {
                const endMin =
                  parseInt(b.startTime.split(':')[0] ?? '0') * 60 +
                  parseInt(b.startTime.split(':')[1] ?? '0') +
                  b.durationMinutes
                const endH = Math.floor(endMin / 60)
                const endM = endMin % 60
                const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
                const payColor =
                  b.paymentStatus === 'PAID'
                    ? 'text-green-400'
                    : b.paymentStatus === 'MANUAL'
                      ? 'text-muted'
                      : 'text-orange-400'
                const payLabel =
                  b.paymentStatus === 'PAID'
                    ? 'Pagado'
                    : b.paymentStatus === 'MANUAL'
                      ? 'Manual'
                      : 'Sin cobrar'

                return (
                  <div key={b.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text">
                        {formatDate(b.date)}
                        <span className="font-mono ml-2 text-muted">
                          {b.startTime}–{endTime}
                        </span>
                      </p>
                    </div>
                    <SourceBadge source={b.source} />
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-text">{formatPrice(b.totalPrice)}</p>
                      <p className={`text-[10px] font-semibold ${payColor}`}>{payLabel}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JugadoresClient({ players }: { players: Player[] }) {
  const [search, setSearch] = useState('')

  const filtered = players.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    )
  })

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-text
                     focus:outline-none focus:border-accent placeholder:text-muted/60 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted mb-3">
        {filtered.length} {filtered.length === 1 ? 'jugador' : 'jugadores'}
        {search ? ` para "${search}"` : ''}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="text-3xl opacity-20">👤</span>
          <p className="text-sm text-muted">
            {search ? 'No hay jugadores que coincidan.' : 'Todavía no hay jugadores registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}
