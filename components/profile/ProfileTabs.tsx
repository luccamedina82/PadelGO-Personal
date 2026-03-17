'use client'

import { useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import { getLevelCategory, formatLevel, levelProgress } from '@/lib/level'

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface ProfileUser {
  name: string
  avatarUrl: string | null
  avatarColor: string
  zone: string
  level: number
  matchesPlayed: number
  matchesWon: number
  streak: number
  lastPlayedAt: Date | null
}

export interface AchievementDisplay {
  key: string
  icon: string
  name: string
  description: string
  category: string
  total: number | null
  progress: number
  unlockedAt: Date | null
}

export interface BookingRow {
  id: string
  date: Date
  startTime: string
  durationMinutes: number
  totalPrice: number
  status: string
  clubName: string
  clubId: string
  courtName: string
}

type Tab = 'overview' | 'reservas' | 'logros' | 'racha'

interface ProfileTabsProps {
  user: ProfileUser
  achievements: AchievementDisplay[]
  activityDates: string[]
  bookings?: BookingRow[]
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10',
  CONFIRMED: 'text-accent bg-accent/10',
  COMPLETED: 'text-green-400 bg-green-400/10',
  CANCELLED: 'text-red-400 bg-red-400/10',
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function buildCalendarDays(): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 34 + i)
    return d
  })
}

function formatDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

// ── COMPONENT ──────────────────────────────────────────────────────────────

export default function ProfileTabs({
  user,
  achievements,
  activityDates,
  bookings = [],
}: ProfileTabsProps) {
  const [tab, setTab] = useState<Tab>('overview')

  const activitySet = new Set(activityDates)
  const calendarDays = buildCalendarDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length
  const winrate =
    user.matchesPlayed > 0 ? Math.round((user.matchesWon / user.matchesPlayed) * 100) : 0
  const lvlPct = levelProgress(user.level)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const lastPlayed = user.lastPlayedAt ? new Date(user.lastPlayedAt) : null
  lastPlayed?.setHours(0, 0, 0, 0)
  const streakAtRisk = user.streak >= 5 && lastPlayed?.getTime() === yesterday.getTime()

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Perfil' },
    { key: 'reservas', label: 'Reservas' },
    { key: 'logros', label: 'Logros' },
    { key: 'racha', label: 'Racha' },
  ]

  return (
    <div>
      {/* ── GRADIENT BANNER ─────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in oklab, var(--accent) 22%, var(--bg)) 0%, var(--bg) 60%)',
          minHeight: 220,
        }}
      >
        {/* Grid overlay pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(color-mix(in oklab, var(--accent) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--accent) 6%, transparent) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative px-4 md:px-8 pt-8 pb-6">
          <div className="flex items-end gap-5">
            {/* Avatar with ring */}
            <div
              className="rounded-full p-0.5 flex-shrink-0"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 40%, transparent))',
              }}
            >
              <Avatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                color={user.avatarColor}
                size="lg"
              />
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-display text-3xl md:text-4xl tracking-widest text-text leading-none">
                {user.name.toUpperCase()}
              </h1>
              <p className="text-sm text-muted mt-0.5">{user.zone}</p>

              {/* Level chip */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-3xl font-bold text-accent leading-none">
                  {formatLevel(user.level)}
                </span>
                <span className="text-xs font-semibold text-sub bg-surface/60 border border-border rounded-full px-2.5 py-0.5">
                  {getLevelCategory(user.level)}
                </span>
              </div>

              {/* Level progress bar */}
              <div className="mt-2.5 max-w-52">
                <div className="h-1.5 bg-surface/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${lvlPct}%`, background: 'var(--accent)' }}
                  />
                </div>
                <p className="text-[10px] text-sub mt-1">{lvlPct}% para el siguiente nivel</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ──────────────────────────────────────────── */}
      <div className="px-4 md:px-8 -mt-3 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Partidos', value: user.matchesPlayed },
            { label: 'Victorias', value: user.matchesWon },
            { label: 'Winrate', value: `${winrate}%` },
            { label: 'Racha', value: `${user.streak}d` },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-xl p-3 text-center shadow-sm"
            >
              <p className="font-mono text-xl font-semibold text-accent">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ────────────────────────────────────────────────── */}
      <div className="border-b border-border px-4 md:px-8 flex gap-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === key
                ? 'text-accent border-accent'
                : 'text-muted border-transparent hover:text-text'
            }`}
          >
            {label}
            {key === 'logros' && (
              <span className="ml-1.5 text-xs text-sub">
                {unlockedCount}/{achievements.length}
              </span>
            )}
            {key === 'reservas' && bookings.length > 0 && (
              <span className="ml-1.5 text-xs text-sub">{bookings.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-6">
        {/* ── PERFIL (OVERVIEW) ──────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-sub uppercase tracking-widest mb-4">
                Tu progreso
              </p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Nivel actual</span>
                  <span className="text-text font-semibold font-mono">
                    {formatLevel(user.level)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Siguiente nivel</span>
                  <span className="text-text font-mono">
                    {Math.min(10, Math.floor(user.level) + 1).toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${lvlPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recent achievements preview */}
            {unlockedCount > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold text-sub uppercase tracking-widest mb-3">
                  Últimos logros
                </p>
                <div className="flex flex-wrap gap-2">
                  {achievements
                    .filter((a) => a.unlockedAt)
                    .slice(-4)
                    .map((a) => (
                      <div
                        key={a.key}
                        className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-3 py-2"
                      >
                        <span className="text-lg">{a.icon}</span>
                        <span className="text-xs font-medium text-accent">{a.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESERVAS ───────────────────────────────────────────── */}
        {tab === 'reservas' && (
          <div>
            {bookings.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🎾</p>
                <p className="text-muted text-sm">Todavía no tenés reservas.</p>
                <Link
                  href="/buscar"
                  className="inline-block mt-4 px-5 py-2.5 bg-accent text-accent-text text-sm font-semibold rounded-xl hover:bg-accent-dark transition-colors"
                >
                  Buscar cancha
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map((bk) => {
                  const hour = bk.startTime.split(':')[0]
                  const min = bk.startTime.split(':')[1]
                  const dd = bk.date.getUTCDate()
                  const month = MONTH_SHORT[bk.date.getUTCMonth()]
                  return (
                    <div
                      key={bk.id}
                      className="bg-card border border-border rounded-2xl flex items-center gap-3 px-4 py-3"
                    >
                      {/* Date-time block */}
                      <div className="flex-shrink-0 w-12 h-12 bg-surface rounded-xl flex flex-col items-center justify-center border border-border">
                        <span className="font-mono text-lg font-bold text-accent leading-none">
                          {hour}
                        </span>
                        <span className="text-[9px] text-muted leading-none mt-0.5">{min}hs</span>
                      </div>

                      {/* Date stamp */}
                      <div className="flex-shrink-0 text-center w-8">
                        <p className="font-mono text-sm font-semibold text-text leading-none">
                          {dd}
                        </p>
                        <p className="text-[10px] text-muted">{month}</p>
                      </div>

                      {/* Club info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text leading-none truncate">
                          {bk.clubName}
                        </p>
                        <p className="text-[11px] text-muted mt-0.5 truncate">
                          {bk.courtName} · {bk.durationMinutes}min
                        </p>
                      </div>

                      {/* Price + status */}
                      <div className="flex-shrink-0 text-right">
                        <p className="font-mono text-[13px] font-bold text-accent leading-none">
                          {formatPrice(bk.totalPrice)}
                        </p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${STATUS_COLOR[bk.status] ?? ''}`}
                        >
                          {STATUS_LABEL[bk.status] ?? bk.status}
                        </span>
                      </div>
                    </div>
                  )
                })}

                <div className="pt-2 text-center">
                  <Link
                    href="/historial"
                    className="text-xs font-semibold text-muted hover:text-accent transition-colors"
                  >
                    Ver historial completo →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOGROS ─────────────────────────────────────────────── */}
        {tab === 'logros' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.map((a) => {
              const isUnlocked = !!a.unlockedAt
              const pct = a.total ? Math.min(100, Math.round((a.progress / a.total) * 100)) : 0
              return (
                <div
                  key={a.key}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isUnlocked
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-card border-border opacity-60'
                  }`}
                >
                  <span className="text-3xl">{a.icon}</span>
                  <p className="text-sm font-semibold text-text mt-2 leading-tight">{a.name}</p>
                  <p className="text-xs text-muted mt-0.5 leading-tight">{a.description}</p>

                  {isUnlocked ? (
                    <p className="text-xs text-accent mt-2 font-medium">✓ Desbloqueado</p>
                  ) : a.total && a.progress > 0 ? (
                    <div className="mt-2">
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent/60 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-sub mt-1">
                        {a.progress}/{a.total}
                      </p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {/* ── RACHA ──────────────────────────────────────────────── */}
        {tab === 'racha' && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-4xl">🔥</span>
              <div>
                <p className="font-mono text-3xl font-semibold text-accent">{user.streak}</p>
                <p className="text-sm text-muted">días consecutivos</p>
              </div>
            </div>

            {streakAtRisk && (
              <div className="mb-5 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3">
                <p className="text-sm text-yellow-400 font-semibold">
                  ⚠️ ¡Llevás {user.streak} días de racha! Jugá hoy para no perderla.
                </p>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-semibold text-sub uppercase tracking-widest mb-3">
                Últimas 5 semanas
              </p>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_SHORT.map((d) => (
                  <div key={d} className="text-center text-xs text-sub">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((d) => {
                  const key = formatDateKey(d)
                  const active = activitySet.has(key)
                  const isToday = d.getTime() === today.getTime()
                  return (
                    <div
                      key={key}
                      title={key}
                      className={`aspect-square rounded-sm flex items-center justify-center ${
                        active
                          ? 'bg-accent'
                          : isToday
                            ? 'bg-surface border border-accent/40'
                            : 'bg-surface'
                      }`}
                    >
                      {isToday && !active && (
                        <span className="text-[8px] text-accent font-bold">hoy</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <div className="w-3 h-3 rounded-sm bg-accent" />
                <span className="text-xs text-muted">Día con partido</span>
                <div className="w-3 h-3 rounded-sm bg-surface ml-2" />
                <span className="text-xs text-muted">Sin partido</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
