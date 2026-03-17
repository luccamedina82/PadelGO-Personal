import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import { formatPrice } from '@/lib/availability'
import AnalyticsControls from './AnalyticsControls'
import {
  calcularIngresos,
  calcularOcupacion,
  calcularHorariosPico,
  calcularIngresosSemanales,
  periodCurrentMonth,
  periodLastNDays,
} from '@/lib/analytics'

interface Props {
  searchParams: Promise<{ start?: string; end?: string }>
}

function parseDateParam(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? undefined : d
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { start: startParam, end: endParam } = await searchParams
  const session = await requireRole(['OWNER'])

  const club = await prisma.club.findFirst({
    where: { ownerId: session.userId },
    select: { id: true, name: true },
  })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  // Determine period: custom or default
  const customStart = parseDateParam(startParam)
  const customEnd = parseDateParam(endParam)

  let period: { start: Date; end: Date }
  let periodLabel: string

  if (customStart && customEnd) {
    period = { start: customStart, end: customEnd }
    periodLabel = `${customStart.toLocaleDateString('es-AR')} a ${customEnd.toLocaleDateString('es-AR')}`
  } else {
    period = periodLastNDays(30)
    periodLabel = 'Últimos 30 días'
  }

  // Also get current month for comparison
  const monthPeriod = periodCurrentMonth()

  const [bookings, barSales, courts, availabilities] = await Promise.all([
    prisma.booking.findMany({
      where: { clubId: club.id, date: { gte: period.start, lte: period.end } },
      select: {
        date: true,
        startTime: true,
        durationMinutes: true,
        totalPrice: true,
        status: true,
        source: true,
        courtId: true,
      },
    }),
    prisma.barSale.findMany({
      where: { clubId: club.id, createdAt: { gte: period.start, lte: period.end } },
      select: { createdAt: true, total: true },
    }),
    prisma.court.findMany({
      where: { clubId: club.id, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.courtAvailability.findMany({
      where: { court: { clubId: club.id } },
      select: { courtId: true, dayOfWeek: true, openTime: true, closeTime: true, isActive: true },
    }),
  ])

  const bookingRecords = bookings.map((b) => ({
    date: b.date,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    totalPrice: b.totalPrice,
    status: b.status,
    source: b.source,
    courtId: b.courtId,
  }))

  const barRecords = barSales.map((s) => ({ createdAt: s.createdAt, total: s.total }))

  const ingresos = calcularIngresos(bookingRecords, barRecords, period)
  const ingresosMonth = calcularIngresos(bookingRecords, barRecords, monthPeriod)
  const ocupacion = calcularOcupacion(bookingRecords, courts, availabilities, period)
  const horarios = calcularHorariosPico(bookingRecords, period)
  const semana = calcularIngresosSemanales(bookingRecords, barRecords)

  // Calculate previous period for comparison
  const prevPeriodStart = new Date(period.start)
  prevPeriodStart.setDate(
    prevPeriodStart.getDate() -
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)
  )
  const prevPeriodEnd = new Date(period.start)
  prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1)

  const prevBookings = await prisma.booking.findMany({
    where: {
      clubId: club.id,
      date: { gte: prevPeriodStart, lte: prevPeriodEnd },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
    select: {
      totalPrice: true,
    },
  })

  const prevBarSales = await prisma.barSale.findMany({
    where: {
      clubId: club.id,
      createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd },
    },
    select: {
      total: true,
    },
  })

  const prevBookingRecords = prevBookings.map((b) => ({ totalPrice: b.totalPrice }))
  const prevBarRecords = prevBarSales.map((s) => ({ total: s.total }))
  const prevIngresos = {
    bookings: prevBookingRecords.reduce((s, b) => s + b.totalPrice, 0),
    bar: prevBarRecords.reduce((s, b) => s + b.total, 0),
    total:
      prevBookingRecords.reduce((s, b) => s + b.totalPrice, 0) +
      prevBarRecords.reduce((s, b) => s + b.total, 0),
  }

  // Calculate percentage changes
  const bookingChange =
    prevIngresos.bookings > 0
      ? ((ingresos.bookings - prevIngresos.bookings) / prevIngresos.bookings) * 100
      : 0
  const barChange =
    prevIngresos.bar > 0 ? ((ingresos.bar - prevIngresos.bar) / prevIngresos.bar) * 100 : 0
  const totalChange =
    prevIngresos.total > 0 ? ((ingresos.total - prevIngresos.total) / prevIngresos.total) * 100 : 0

  // Court revenue breakdown
  const courtRevenue = courts
    .map((court) => {
      const rev = bookingRecords
        .filter(
          (b) => b.courtId === court.id && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
        )
        .reduce((s, b) => s + b.totalPrice, 0)
      const occ = ocupacion.byCourt.get(court.id) ?? 0
      return { ...court, revenue: rev, occupancy: occ }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const maxCourtRev = Math.max(...courtRevenue.map((c) => c.revenue), 1)

  // Source breakdown
  const sourceCount = { ONLINE: 0, MANUAL_OWNER: 0, BLOCK: 0, MANUAL_SUPPORT: 0 }
  for (const b of bookingRecords.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED'
  )) {
    const key = b.source as keyof typeof sourceCount
    sourceCount[key] = (sourceCount[key] ?? 0) + 1
  }
  const totalSourceCount = Object.values(sourceCount).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="font-semibold text-text">Analytics — {club.name}</h1>
            <p className="text-xs text-muted">{periodLabel}</p>
          </div>
          <AnalyticsControls startDate={startParam} endDate={endParam} />
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-accent/30 rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Ingresos totales</p>
            <p className="font-mono font-bold text-accent text-lg">{formatPrice(ingresos.total)}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted font-mono">
                {formatPrice(ingresosMonth.total)} este mes
              </p>
              {totalChange !== 0 && (
                <span
                  className={`text-[10px] font-bold ${totalChange > 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {totalChange > 0 ? '+' : ''}
                  {totalChange.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Canchas</p>
            <p className="font-mono font-bold text-text text-lg">
              {formatPrice(ingresos.bookings)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted">
                {
                  bookingRecords.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
                    .length
                }{' '}
                reservas
              </p>
              {bookingChange !== 0 && (
                <span
                  className={`text-[10px] font-bold ${bookingChange > 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {bookingChange > 0 ? '+' : ''}
                  {bookingChange.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Bar</p>
            <p className="font-mono font-bold text-text text-lg">{formatPrice(ingresos.bar)}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted">{barSales.length} ventas</p>
              {barChange !== 0 && (
                <span
                  className={`text-[10px] font-bold ${barChange > 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {barChange > 0 ? '+' : ''}
                  {barChange.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Ocupación</p>
            <p className="font-display text-3xl text-text">{ocupacion.percentage}%</p>
            <p className="text-xs text-muted mt-0.5">
              Pico:{' '}
              {
                horarios
                  .reduce(
                    (best, h) => (h.count > best.count ? h : best),
                    horarios[0] ?? { label: '—' }
                  )
                  .label.split('–')[0]
              }
            </p>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-4">Ingresos últimos 7 días</h2>
          <div className="flex items-end gap-2 h-32">
            {semana.map((day) => {
              const maxVal = Math.max(...semana.map((d) => d.total), 1)
              const bookH = Math.round((day.bookings / maxVal) * 100)
              const barH = Math.round((day.bar / maxVal) * 100)
              return (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full flex flex-col justify-end gap-0.5"
                    style={{ height: '100px' }}
                  >
                    {day.bar > 0 && (
                      <div
                        className="w-full rounded-t bg-orange-400/60"
                        style={{ height: `${barH}%` }}
                      />
                    )}
                    {day.bookings > 0 && (
                      <div
                        className={`w-full rounded-t ${day.isToday ? 'bg-accent' : 'bg-accent/40'}`}
                        style={{ height: `${bookH}%` }}
                      />
                    )}
                    {day.total === 0 && (
                      <div className="w-full bg-border/30 rounded" style={{ height: '4px' }} />
                    )}
                  </div>
                  <span
                    className={`text-[10px] ${day.isToday ? 'text-accent font-bold' : 'text-muted'}`}
                  >
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-accent/40" />
              <span className="text-xs text-muted">Canchas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-orange-400/60" />
              <span className="text-xs text-muted">Bar</span>
            </div>
          </div>
        </div>

        {/* Peak hours */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Horarios más demandados</h2>
          <div className="space-y-1.5">
            {horarios
              .filter((h) => h.count > 0)
              .map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted w-12 shrink-0">
                    {h.label.split('–')[0]}
                  </span>
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${h.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{h.count}</span>
                </div>
              ))}
            {horarios.every((h) => h.count === 0) && (
              <p className="text-sm text-muted text-center py-4">Sin reservas en este período</p>
            )}
          </div>
        </div>

        {/* Court ranking */}
        {courtRevenue.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm text-text mb-3">Canchas por ingresos</h2>
            <div className="space-y-2">
              {courtRevenue.map((court, idx) => (
                <div key={court.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-4 shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-text">{court.name}</span>
                      <span className="text-xs font-mono text-muted">{court.occupancy}% ocup.</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/60 rounded-full"
                        style={{ width: `${Math.round((court.revenue / maxCourtRev) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent shrink-0 w-20 text-right">
                    {formatPrice(court.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source breakdown */}
        {totalSourceCount > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm text-text mb-3">Origen de reservas</h2>
            <div className="space-y-2">
              {[
                { key: 'ONLINE', label: 'Web / App', color: 'bg-blue-400' },
                { key: 'MANUAL_OWNER', label: 'Manual (staff)', color: 'bg-orange-400' },
                { key: 'BLOCK', label: 'Bloqueos', color: 'bg-sub' },
              ].map(({ key, label, color }) => {
                const count = sourceCount[key as keyof typeof sourceCount] ?? 0
                const pct = totalSourceCount > 0 ? Math.round((count / totalSourceCount) * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                    <span className="text-sm text-text flex-1">{label}</span>
                    <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color} opacity-60`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-16 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
