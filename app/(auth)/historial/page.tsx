import Link from 'next/link'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/actions/auth'
import { formatPrice } from '@/lib/availability'
import { argToday } from '@/lib/date'

// ── TYPES ─────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ tab?: string }>
type PageProps = { searchParams: SearchParams }

// ── HELPERS ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
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

// ── PROACTIVE SUGGESTION ──────────────────────────────────────────────────

async function getProactiveSuggestion(userId: string) {
  const recent = await prisma.booking.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { date: 'desc' },
    take: 20,
    include: { club: { select: { id: true, name: true, zone: true } } },
  })

  if (recent.length < 3) return null

  // Most common (dayOfWeek-time) pattern
  const freq = new Map<string, number>()
  for (const b of recent) {
    const key = `${b.date.getUTCDay()}-${b.startTime}`
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }

  let topKey = '',
    maxCount = 0
  for (const [k, n] of freq) {
    if (n > maxCount) {
      maxCount = n
      topKey = k
    }
  }
  if (maxCount < 2) return null

  const [dayStr, time] = topKey.split('-')
  const dayOfWeek = parseInt(dayStr)

  // Next occurrence of this dayOfWeek
  const now = argToday()
  let daysAhead = (dayOfWeek - now.getUTCDay() + 7) % 7
  if (daysAhead === 0) daysAhead = 7
  const nextDate = new Date(now)
  nextDate.setUTCDate(now.getUTCDate() + daysAhead)

  // Most visited club
  const clubFreq = new Map<string, { count: number; name: string; zone: string }>()
  for (const b of recent) {
    const e = clubFreq.get(b.club.id)
    if (e) e.count++
    else clubFreq.set(b.club.id, { count: 1, name: b.club.name, zone: b.club.zone })
  }
  let topClub: { id: string; name: string; zone: string } | null = null
  let topClubCount = 0
  for (const [id, data] of clubFreq) {
    if (data.count > topClubCount) {
      topClubCount = data.count
      topClub = { id, ...data }
    }
  }
  if (!topClub) return null

  return { dayOfWeek, dayLabel: DAY_NAMES[dayOfWeek], time, nextDate, club: topClub }
}

// ── STATS ─────────────────────────────────────────────────────────────────

async function getStats(userId: string) {
  const all = await prisma.booking.findMany({
    where: { userId, status: { in: ['COMPLETED', 'CONFIRMED'] } },
    include: { club: { select: { id: true, name: true } } },
  })

  const completed = all.filter((b) => b.status === 'COMPLETED')
  if (all.length === 0) return null

  // Favorite club
  const clubFreq = new Map<string, { name: string; count: number }>()
  for (const b of all) {
    const e = clubFreq.get(b.club.id)
    if (e) e.count++
    else clubFreq.set(b.club.id, { name: b.club.name, count: 1 })
  }
  let favClub = '',
    favCount = 0
  for (const [, d] of clubFreq) {
    if (d.count > favCount) {
      favCount = d.count
      favClub = d.name
    }
  }

  // Peak hour
  const hourFreq = new Map<string, number>()
  for (const b of all) {
    hourFreq.set(b.startTime, (hourFreq.get(b.startTime) ?? 0) + 1)
  }
  let peakHour = '',
    peakCount = 0
  for (const [h, n] of hourFreq) {
    if (n > peakCount) {
      peakCount = n
      peakHour = h
    }
  }

  // Favorite day
  const dayFreq = [0, 0, 0, 0, 0, 0, 0]
  for (const b of all) dayFreq[b.date.getUTCDay()]++
  const favDayIdx = dayFreq.indexOf(Math.max(...dayFreq))

  // Revenue spent
  const totalSpent = all.reduce((sum, b) => sum + b.totalPrice, 0)

  return {
    total: all.length,
    completed: completed.length,
    favClub,
    peakHour,
    favDay: DAY_NAMES[favDayIdx],
    totalSpent,
    clubCount: clubFreq.size,
  }
}

// ── PAGE ───────────────────────────────────────────────────────────────────

export default async function HistorialPage({ searchParams }: PageProps) {
  const session = await requireAuth()
  const { tab = 'partidos' } = await searchParams

  const [bookings, suggestion, stats] = await Promise.all([
    tab === 'partidos'
      ? prisma.booking.findMany({
          where: {
            OR: [{ userId: session.userId }, { playerIds: { has: session.userId } }],
          },
          orderBy: { date: 'desc' },
          take: 50,
          include: {
            club: { select: { id: true, name: true, zone: true } },
            court: { select: { name: true } },
            user: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    getProactiveSuggestion(session.userId),
    tab === 'estadisticas' ? getStats(session.userId) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen px-4 md:px-8 pt-8 pb-16 max-w-[1360px] mx-auto">
      {/* Header */}
      <h1 className="font-display text-3xl md:text-4xl tracking-widest text-text mb-2">
        MIS RESERVAS
      </h1>

      {/* Proactive suggestion */}
      {suggestion && (
        <div className="mb-6 bg-accent/10 border border-accent/30 rounded-2xl p-4">
          <p className="text-xs font-semibold text-accent tracking-widest uppercase mb-1">
            Sugerencia
          </p>
          <p className="text-sm text-text">
            Solés jugar los <strong>{suggestion.dayLabel}</strong> a las{' '}
            <strong>{suggestion.time}</strong> — este {suggestion.dayLabel.toLowerCase()} hay
            canchas en <strong>{suggestion.club.name}</strong>.
          </p>
          <Link
            href={`/club/${suggestion.club.id}`}
            className="inline-block mt-2 text-xs font-semibold text-accent hover:text-accent-dark transition-colors"
          >
            Reservar ahora →
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-6">
        {[
          { key: 'partidos', label: 'Mis partidos' },
          { key: 'estadisticas', label: 'Estadísticas' },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/historial${key !== 'partidos' ? `?tab=${key}` : ''}`}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'text-accent border-accent'
                : 'text-muted border-transparent hover:text-text'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Tab: Partidos ──────────────────────────────────── */}
      {tab === 'partidos' && (
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
            <div className="space-y-3">
              {bookings.map((booking) => {
                const dd = booking.date.getUTCDate()
                const month = MONTH_SHORT[booking.date.getUTCMonth()]
                const year = booking.date.getUTCFullYear()
                const isJoined = booking.userId !== session.userId
                return (
                  <div
                    key={booking.id}
                    className="bg-card border border-border rounded-2xl p-4 flex gap-4"
                  >
                    {/* Date stamp */}
                    <div className="flex-shrink-0 w-12 text-center">
                      <p className="font-mono text-xl font-semibold text-accent leading-none">
                        {dd}
                      </p>
                      <p className="text-xs text-muted">{month}</p>
                      <p className="text-xs text-sub">{year}</p>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text leading-none">
                            {booking.club.name}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {booking.court.name} · {booking.startTime} · {booking.durationMinutes}
                            min
                          </p>
                          {isJoined && (
                            <p className="text-[10px] text-accent mt-0.5">
                              Turno abierto · Host: {booking.user.name.split(' ')[0]}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[booking.status] ?? ''}`}
                        >
                          {STATUS_LABEL[booking.status] ?? booking.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="font-mono text-sm text-accent font-semibold">
                          {formatPrice(booking.totalPrice)}
                        </span>
                        <Link
                          href={`/club/${booking.club.id}`}
                          className="text-xs text-muted hover:text-accent transition-colors"
                        >
                          Repetir turno →
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Estadísticas ──────────────────────────────── */}
      {tab === 'estadisticas' && (
        <div>
          {!stats ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-muted text-sm">Jugá algunos partidos para ver tus estadísticas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Partidos totales', value: stats.total, icon: '🎾' },
                { label: 'Completados', value: stats.completed, icon: '✅' },
                { label: 'Club favorito', value: stats.favClub || '—', icon: '🏟' },
                { label: 'Horario pico', value: stats.peakHour || '—', icon: '⏰' },
                { label: 'Día estrella', value: stats.favDay, icon: '📅' },
                { label: 'Clubes visitados', value: stats.clubCount, icon: '🗺' },
                { label: 'Gasto total', value: formatPrice(stats.totalSpent), icon: '💰' },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="font-mono text-xl font-semibold text-accent mt-1">{s.value}</p>
                  <p className="text-xs text-muted mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
