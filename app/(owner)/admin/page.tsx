import { formatPrice } from '@/lib/availability'
import { periodToday, calcularIngresos } from '@/lib/analytics'
import { argToday, argTomorrow, argNowMinutes } from '@/lib/date'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import AdminRefresher from './AdminRefresher'
import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/lib/dal/court'
import { getAdminBookingsByDate } from '@/lib/dal/booking'
import { getBarSalesPeriod, getCachedBarProducts } from '@/lib/dal/bar'
import { getTrendBookings } from '@/lib/dal/analytic'


// ── HELPERS ──────────────────────────────────────────────────────────────────

function sourceLabel(source: string) {
  switch (source) {
    case 'ONLINE':
      return { label: 'Web', color: 'text-blue-400', dot: 'bg-blue-400' }
    case 'MANUAL_OWNER':
      return { label: 'Manual', color: 'text-orange-400', dot: 'bg-orange-400' }
    case 'BLOCK':
      return { label: 'Bloqueo', color: 'text-sub', dot: 'bg-sub' }
    default:
      return { label: source, color: 'text-muted', dot: 'bg-muted' }
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return 'text-green-400 bg-green-400/10'
    case 'PENDING':
      return 'text-yellow-400 bg-yellow-400/10'
    case 'CANCELLED':
      return 'text-red-400 bg-red-400/10'
    case 'COMPLETED':
      return 'text-muted bg-muted/10'
    default:
      return 'text-muted bg-muted/10'
  }
}


// ── PAGE ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const {session, club} = await getAdminContext(['OWNER', 'STAFF'])

  if(!club) {
    return (
      <div className="p-8 text-center text-muted">
        No tenés ningún club asignado.{' '}
        {session.role === 'OWNER' && <span>Contactá a soporte para configurar tu club.</span>}
      </div>
    )
  }

  // ── TIMEZONE-SAFE DATES ──────────────────────────────────────────────────
  const today = argToday()
  const tomorrow = argTomorrow()
  const nowMinutes = argNowMinutes()

  // Base for sparkline: 13 days ago (gives us 13 prior days + today = 14 total)
  const thirteenDaysAgo = new Date(today)
  thirteenDaysAgo.setUTCDate(thirteenDaysAgo.getUTCDate() - 13)

  // ── QUERIES ──────────────────────────────────────────────────────────────
  const courts = await getCourtsByClubId(club.id)
  const todayBookings = await getAdminBookingsByDate(club.id, today, tomorrow)
  const todaySales = await getBarSalesPeriod(club.id, today, tomorrow)
  const allProducts = await getCachedBarProducts(club.id)
  const lowStockProducts = allProducts.filter(p => p.active && p.stock <= (p.minStock || 0))
  const last13Bookings = await getTrendBookings(club.id, thirteenDaysAgo, today)

  // Filter low stock products
  const lowStockProductsFiltered = lowStockProducts.filter((p) => p.stock <= p.minStock)

  // ── METRICS ──────────────────────────────────────────────────────────────
  const period = periodToday()
  const ingresos = calcularIngresos(
    todayBookings.map((b) => ({
      date: new Date(`${b.date}T00:00:00.000Z`),
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      totalPrice: b.totalPrice,
      status: b.status,
      source: b.source,
      courtId: b.courtId,
    })),
    todaySales.map((s) => ({ createdAt: new Date(), total: s.total })),
    period
  )

  const confirmedToday = todayBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED'
  )
  const nonCancelledTodayCount = todayBookings.filter((b) => b.status !== 'CANCELLED').length
  const pendingToday = todayBookings.filter((b) => b.status === 'PENDING')

  const unpaidToday = todayBookings
    .filter((b) => b.paymentStatus === 'UNPAID' && b.status !== 'CANCELLED' && b.source !== 'BLOCK')
    .reduce((s, b) => s + b.totalPrice, 0)

  // Upcoming bookings (starting in the next 3 hours)
  const upcomingBookings = todayBookings
    .filter((b) => {
      const [h, m] = b.startTime.split(':').map(Number)
      const startMin = (h ?? 0) * 60 + (m ?? 0)
      return startMin >= nowMinutes && startMin <= nowMinutes + 180 && b.status === 'CONFIRMED'
    })
    .slice(0, 5)

  // Court status: which courts are busy right now
  const currentBookingByCourt = new Map<string, (typeof todayBookings)[number]>()
  for (const booking of todayBookings) {
    if (booking.status !== 'CONFIRMED') continue
    const [h, m] = booking.startTime.split(':').map(Number)
    const startMin = (h ?? 0) * 60 + (m ?? 0)
    if (startMin <= nowMinutes && startMin + booking.durationMinutes > nowMinutes) {
      currentBookingByCourt.set(booking.courtId, booking)
    }
  }
  const busyCourts = new Set(currentBookingByCourt.keys())
  const freeCourts = courts.filter((c) => !busyCourts.has(c.id))

  // ── SPARKLINE ────────────────────────────────────────────────────────────
  const DOW_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

  const bookingCountByDate = new Map<string, number>()
  for (const booking of last13Bookings) {
    const dateKey = booking.date.toISOString().split('T')[0] ?? ''
    bookingCountByDate.set(dateKey, (bookingCountByDate.get(dateKey) ?? 0) + 1)
  }

  const sparklineData = Array.from({ length: 7 }, (_, i) => {
    const offset = i - 6 // -6, -5, ..., 0
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() + offset)
    const dateStr = d.toISOString().split('T')[0]!
    const isToday = offset === 0
    const dow = DOW_SHORT[d.getUTCDay()] ?? ''
    const count = isToday ? nonCancelledTodayCount : (bookingCountByDate.get(dateStr) ?? 0)
    return { dateStr, count, isToday, dow }
  })
  const maxSparkline = Math.max(...sparklineData.map((d) => d.count), 1)

  // Week‑over‑week comparison: current 7 days vs previous 7 days
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const currentWeekCount = sparklineData.reduce((s, d) => s + d.count, 0)
  const prevWeekCount = last13Bookings.filter((b) => b.date < sevenDaysAgo).length
  const weekChangePct =
    prevWeekCount > 0
      ? Math.round(((currentWeekCount - prevWeekCount) / prevWeekCount) * 100)
      : null

  return (
    <div className="min-h-screen bg-bg p-4 md:p-6 max-w-5xl mx-auto">
        <AdminRefresher />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl text-text tracking-wide uppercase">{club.name}</h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'America/Argentina/Buenos_Aires',
            })}
          </p>
        </div>
        <Link
          href="/admin/reservas/nueva"
          className="bg-accent text-accent-text font-semibold text-sm px-4 py-2 rounded-lg hover:bg-accent-dark transition-colors"
        >
          + Nueva reserva
        </Link>
      </div>

      {/* Pending confirmations alert */}
      {pendingToday.length > 0 && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-yellow-400/5 border border-yellow-400/25 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-yellow-400">
              {pendingToday.length} reserva{pendingToday.length > 1 ? 's' : ''} sin confirmar hoy
            </span>
          </div>
          <Link href="/admin/reservas" className="text-xs text-accent hover:underline shrink-0">
            Ver grilla →
          </Link>
        </div>
      )}

      {/* Low stock alert */}
      {lowStockProductsFiltered.length > 0 && (
        <Link href="/admin/bar?tab=inventario">
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-orange-400/5 border border-orange-400/25 rounded-xl hover:border-orange-400/50 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="text-xl shrink-0">⚠️</span>
              <span className="text-sm font-medium text-orange-400">
                {lowStockProductsFiltered.length} producto
                {lowStockProductsFiltered.length !== 1 ? 's' : ''} bajo stock mínimo
              </span>
            </div>
            <span className="text-xs text-orange-400 font-semibold whitespace-nowrap shrink-0">
              Ver →
            </span>
          </div>
        </Link>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Reservas hoy</p>
          <p className="font-display text-3xl text-text">{confirmedToday.length}</p>
          {weekChangePct !== null && (
            <p
              className={`text-xs mt-0.5 font-semibold ${weekChangePct >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {weekChangePct >= 0 ? '+' : ''}
              {weekChangePct}% esta semana
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Canchas libres ahora</p>
          <p className="font-display text-3xl text-text">{freeCourts.length}</p>
          <p className="text-xs text-muted mt-0.5">de {courts.length} totales</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Ingresos hoy</p>
          <p className="font-mono text-xl font-bold text-accent">{formatPrice(ingresos.total)}</p>
          <p className="text-xs text-muted mt-0.5">Canchas: {formatPrice(ingresos.bookings)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Por cobrar hoy</p>
          <p
            className={`font-mono text-xl font-bold ${unpaidToday > 0 ? 'text-orange-400' : 'text-muted'}`}
          >
            {formatPrice(unpaidToday)}
          </p>
          <p className="text-xs text-muted mt-0.5">Bar: {formatPrice(ingresos.bar)}</p>
        </div>
      </div>

      {/* Sparkline — ocupación semanal */}
      <div className="mb-4 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">Reservas — últimos 7 días</h2>
          {weekChangePct !== null && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                weekChangePct >= 0
                  ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                  : 'text-red-400 bg-red-400/10 border border-red-400/20'
              }`}
            >
              {weekChangePct >= 0 ? '+' : ''}
              {weekChangePct}% vs semana anterior
            </span>
          )}
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {sparklineData.map(({ dateStr, count, isToday, dow }) => {
            const heightPct = count > 0 ? Math.max((count / maxSparkline) * 100, 10) : 0
            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: 40 }}>
                  <div
                    className={`w-full rounded-t ${isToday ? 'bg-accent' : 'bg-border-hover'} transition-all`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className={`text-[9px] font-bold leading-none ${isToday ? 'text-accent' : 'text-muted'}`}
                >
                  {dow}
                </span>
                {count > 0 && (
                  <span
                    className={`text-[9px] leading-none font-mono ${isToday ? 'text-accent' : 'text-sub'}`}
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Court status */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Estado de canchas ahora</h2>
          <div className="space-y-2">
            {courts.map((court) => {
              const currentBooking = currentBookingByCourt.get(court.id) ?? null
              const isBusy = Boolean(currentBooking)

              return (
                <div key={court.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2 h-2 rounded-full ${isBusy ? 'bg-red-400' : 'bg-green-400'}`}
                    />
                    <span className="text-sm text-text">{court.name}</span>
                  </div>
                  <div className="text-right">
                    {isBusy && currentBooking ? (
                      <>
                        <p className="text-xs text-muted">
                          hasta{' '}
                          {(() => {
                            const [h, m] = currentBooking.startTime.split(':').map(Number)
                            const endMin = (h ?? 0) * 60 + (m ?? 0) + currentBooking.durationMinutes
                            return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
                          })()}
                        </p>
                        <p className="text-xs text-orange-400 truncate max-w-[120px]">
                          {currentBooking.manualName ?? currentBooking.user.name.split(' ')[0]}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-green-400">Libre</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <Link
            href="/admin/reservas"
            className="mt-3 block text-center text-xs text-accent hover:underline"
          >
            Ver grilla completa →
          </Link>
        </div>

        {/* Upcoming bookings */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Próximas reservas</h2>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">
              No hay reservas en las próximas 3 horas
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingBookings.map((booking) => {
                const src = sourceLabel(booking.source)
                return (
                  <div
                    key={booking.id}
                    className="flex items-start gap-3 py-1.5 border-b border-border last:border-0"
                  >
                    <div className="text-right w-12 shrink-0">
                      <p className="font-mono text-sm font-bold text-text">{booking.startTime}</p>
                      <p className="text-xs text-muted">{booking.durationMinutes}min</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">
                        {booking.manualName ?? booking.user.name}
                      </p>
                      <p className="text-xs text-muted">{courts[Number(booking.courtId)]?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${src.dot}`} />
                      <span className={`text-xs ${src.color}`}>{src.label}</span>
                    </div>
                    {booking.paymentStatus === 'UNPAID' && (
                      <span className="text-[9px] text-orange-400 font-bold">$</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <Link
            href="/admin/reservas"
            className="mt-3 block text-center text-xs text-accent hover:underline"
          >
            Ver todas las reservas →
          </Link>
        </div>
      </div>

      {/* Today summary */}
      {todayBookings.length > 0 && (
        <div className="mt-4 bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">
            Resumen del día ({todayBookings.length} reserva
            {todayBookings.length !== 1 ? 's' : ''})
          </h2>
          <div className="space-y-1.5">
            {todayBookings.slice(0, 8).map((booking) => {
              const src = sourceLabel(booking.source)
              const sColor = statusColor(booking.status)
              const [h, m] = booking.startTime.split(':').map(Number)
              const endMin = (h ?? 0) * 60 + (m ?? 0) + booking.durationMinutes
              const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
              return (
                <div
                  key={booking.id}
                  className="flex items-center gap-3 text-sm py-1 border-b border-border/50 last:border-0"
                >
                  <span className="font-mono text-text w-20 shrink-0">
                    {booking.startTime}–{endTime}
                  </span>
                  <span className="text-muted text-xs w-20 shrink-0">{courts[Number(booking.courtId)]?.name}</span>
                  <span className="flex-1 truncate text-text">
                    {booking.source === 'BLOCK'
                      ? `🔒 ${booking.manualName ?? 'Bloqueo'}`
                      : (booking.manualName ?? booking.user.name)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${sColor}`}>
                    {booking.status === 'CONFIRMED'
                      ? 'Conf.'
                      : booking.status === 'PENDING'
                        ? 'Pend.'
                        : booking.status === 'CANCELLED'
                          ? 'Canc.'
                          : 'Comp.'}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${src.dot}`} />
                    <span className={`text-xs ${src.color}`}>{src.label}</span>
                  </div>
                  {booking.paymentStatus === 'UNPAID' && booking.source !== 'BLOCK' && (
                    <span className="text-[9px] text-orange-400 font-bold opacity-70">$</span>
                  )}
                </div>
              )
            })}
            {todayBookings.length > 8 && (
              <Link
                href="/admin/reservas"
                className="block text-center text-xs text-accent hover:underline pt-1"
              >
                Ver {todayBookings.length - 8} más →
              </Link>
            )}
          </div>
        </div>
      )
      }
    </div>
  )
}
