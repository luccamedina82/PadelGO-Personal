import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import { formatPrice } from '@/lib/availability'
import { periodToday, periodLastNDays } from '@/lib/analytics'
import { argToday, argTodayStr } from '@/lib/date'
import Link from 'next/link'

function auditActionLabel(action: string) {
  const map: Record<string, string> = {
    CREATE_CLUB: 'Club creado',
    UPDATE_CLUB: 'Club actualizado',
    ACTIVATE_CLUB: 'Club activado',
    DEACTIVATE_CLUB: 'Club desactivado',
    CREATE_COURT: 'Cancha creada',
    UPDATE_COURT: 'Cancha actualizada',
    CANCEL_BOOKING: 'Reserva cancelada',
    DEACTIVATE_USER: 'Usuario desactivado',
    ACTIVATE_USER: 'Usuario activado',
    BAN_USER: 'Usuario baneado',
    UNBAN_USER: 'Ban levantado',
    RESET_USER_PASSWORD: 'Password reseteado',
    UPDATE_CLUB_AVAILABILITY: 'Horarios actualizados',
    INVITE_STAFF: 'Staff invitado',
    REMOVE_STAFF: 'Staff removido',
    CREATE_MANUAL_BOOKING: 'Reserva manual creada',
  }
  return map[action] ?? action
}

function auditActionColor(action: string) {
  if (['CREATE_CLUB', 'ACTIVATE_CLUB', 'ACTIVATE_USER', 'UNBAN_USER'].includes(action))
    return 'text-green-400 bg-green-400/10'
  if (['BAN_USER'].includes(action)) return 'text-red-400 bg-red-400/10'
  if (['DEACTIVATE_CLUB', 'DEACTIVATE_USER', 'REMOVE_STAFF'].includes(action))
    return 'text-orange-400 bg-orange-400/10'
  if (['INVITE_STAFF'].includes(action)) return 'text-purple-400 bg-purple-400/10'
  return 'text-blue-400 bg-blue-400/10'
}

export default async function SuperadminDashboardPage() {
  await requireSuperAdmin()

  const today = periodToday()
  const last7Days = periodLastNDays(7)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalClubs,
    activeClubs,
    todayBookings,
    todayBarSales,
    allClubs,
    newUsers,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.club.count(),
    prisma.club.count({ where: { isActive: true } }),
    prisma.booking.findMany({
      where: { date: { gte: today.start, lt: today.end } },
      select: { totalPrice: true, status: true, source: true },
    }),
    prisma.barSale.findMany({
      where: { createdAt: { gte: today.start, lt: today.end } },
      select: { total: true },
    }),
    prisma.club.findMany({
      select: {
        id: true,
        name: true,
        zone: true,
        isActive: true,
        _count: { select: { bookings: true, courts: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { name: true, avatarColor: true } },
      },
    }),
  ])

  const todayRevenue =
    todayBookings
      .filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
      .reduce((s, b) => s + b.totalPrice, 0) + todayBarSales.reduce((s, b) => s + b.total, 0)

  const todayBookingCount = todayBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'PENDING'
  ).length

  // Weekly revenue chart — last 7 days using Argentina UTC midnight boundaries
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(argToday())
    start.setUTCDate(start.getUTCDate() - (6 - i))
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    return { date: start, start, end }
  })

  const [weeklyBookings, weeklyBarSales] = await Promise.all([
    prisma.booking.findMany({
      where: { date: { gte: last7Days.start, lt: last7Days.end } },
      select: { date: true, totalPrice: true, status: true },
    }),
    prisma.barSale.findMany({
      where: { createdAt: { gte: last7Days.start, lt: last7Days.end } },
      select: { createdAt: true, total: true },
    }),
  ])

  const chartData = weeklyData.map(({ date, start, end }) => {
    const bRev = weeklyBookings
      .filter(
        (b) =>
          b.date >= start && b.date < end && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
      )
      .reduce((s, b) => s + b.totalPrice, 0)
    const barRev = weeklyBarSales
      .filter((s) => s.createdAt >= start && s.createdAt < end)
      .reduce((s, b) => s + b.total, 0)
    const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const y = date.getUTCFullYear()
    const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    const isToday = `${y}-${mo}-${d}` === argTodayStr()
    return { label: dow[date.getUTCDay()] ?? '', bRev, barRev, total: bRev + barRev, isToday }
  })

  const maxChartValue = Math.max(...chartData.map((d) => d.total), 1)

  function relativeTime(date: Date): string {
    const diff = Date.now() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `Hace ${days}d`
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto" style={{ background: '#0a0810' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-display text-3xl tracking-wide uppercase"
            style={{ color: '#a855f7' }}
          >
            Dashboard Global
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1.5 rounded-full border"
          style={{
            color: '#a855f7',
            borderColor: 'rgba(168,85,247,0.4)',
            background: 'rgba(168,85,247,0.1)',
          }}
        >
          ⚡ SUPERADMIN
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(168,85,247,0.08)',
            borderColor: 'rgba(168,85,247,0.25)',
          }}
        >
          <p className="text-xs text-muted mb-1">Ingresos hoy</p>
          <p className="font-mono text-xl font-bold" style={{ color: '#a855f7' }}>
            {formatPrice(todayRevenue)}
          </p>
          <p className="text-xs text-muted mt-0.5">Todos los clubes</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Reservas hoy</p>
          <p className="font-display text-3xl text-text">{todayBookingCount}</p>
          <p className="text-xs text-muted mt-0.5">Online + manual</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Clubes activos</p>
          <p className="font-display text-3xl text-text">{activeClubs}</p>
          <p className="text-xs text-muted mt-0.5">de {totalClubs} registrados</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Usuarios nuevos</p>
          <p className="font-display text-3xl text-text">{newUsers}</p>
          <p className="text-xs text-muted mt-0.5">Últimos 7 días</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Weekly chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-4">Ingresos — últimos 7 días</h2>
          <div className="flex items-end gap-2 h-28">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.round((d.total / maxChartValue) * 80)}px`,
                      background: d.isToday
                        ? 'rgba(168,85,247,0.7)'
                        : d.total > 0
                          ? 'rgba(168,85,247,0.25)'
                          : 'rgba(168,85,247,0.08)',
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] ${d.isToday ? 'font-bold' : ''}`}
                  style={{ color: d.isToday ? '#a855f7' : '#777' }}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent audit log */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-text">Actividad reciente</h2>
            <Link
              href="/superadmin/audit"
              className="text-xs text-muted hover:underline"
              style={{ color: 'rgba(168,85,247,0.8)' }}
            >
              Ver log completo →
            </Link>
          </div>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Sin actividad registrada</p>
          ) : (
            <div className="space-y-2">
              {recentAuditLogs.map((log) => {
                const color = auditActionColor(log.action)
                return (
                  <div key={log.id} className="flex items-center gap-2.5">
                    <span className="text-xs text-sub w-12 shrink-0">
                      {relativeTime(log.createdAt)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color}`}>
                      {auditActionLabel(log.action)}
                    </span>
                    <span className="text-xs text-muted truncate flex-1">
                      {log.entityType} · {log.entityId.slice(-6)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clubs grid */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm text-text">Estado de clubes hoy</h2>
          <Link
            href="/superadmin/clubs"
            className="text-xs font-medium"
            style={{ color: 'rgba(168,85,247,0.8)' }}
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {allClubs.map((club) => {
            const todayClubBookings = todayBookings.filter(() => true) // approximate
            return (
              <Link
                key={club.id}
                href={`/superadmin/clubs/${club.id}`}
                className={`border rounded-lg p-3 hover:bg-card-hover transition-colors ${
                  !club.isActive ? 'opacity-50' : ''
                }`}
                style={{ borderColor: '#242424' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-medium text-sm text-text truncate">{club.name}</p>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      club.isActive
                        ? 'text-green-400 bg-green-400/10'
                        : 'text-red-400 bg-red-400/10'
                    }`}
                  >
                    {club.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-muted">{club.zone}</p>
                <p className="text-xs text-sub mt-1">
                  {club._count.courts} canchas · {club._count.bookings} reservas totales
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
