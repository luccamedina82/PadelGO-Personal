import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import SuperadminBanner from '@/components/layout/SuperadminBanner'
import { formatPrice } from '@/lib/availability'
import {
  calcularIngresos,
  calcularOcupacion,
  calcularHorariosPico,
  calcularIngresosSemanales,
  periodLastNDays,
} from '@/lib/analytics'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SuperadminClubAnalyticsPage({ params }: Props) {
  await requireSuperAdmin()

  const { id } = await params

  const club = await prisma.club.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      zone: true,
      isActive: true,
      _count: { select: { courts: true } },
    },
  })

  if (!club) notFound()

  const last30 = periodLastNDays(30)

  const [bookings, barSales, courts] = await Promise.all([
    prisma.booking.findMany({
      where: { clubId: id, date: { gte: last30.start, lt: last30.end } },
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
      where: { clubId: id, createdAt: { gte: last30.start, lt: last30.end } },
      select: { createdAt: true, total: true },
    }),
    prisma.court.findMany({
      where: { clubId: id, isActive: true },
      select: { id: true, name: true },
    }),
    
  ])

  const bookingRecords = bookings.map((b) => ({ ...b }))
  const barRecords = barSales.map((s) => ({ ...s }))

  const ingresos = calcularIngresos(bookingRecords, barRecords, last30)
  const ocupacion = calcularOcupacion(bookingRecords, courts, [], last30)
  const horarios = calcularHorariosPico(bookingRecords, last30)
  const semana = calcularIngresosSemanales(bookingRecords, barRecords)

  const courtRevenue = courts
    .map((court) => {
      const rev = bookingRecords
        .filter(
          (b) => b.courtId === court.id && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
        )
        .reduce((s, b) => s + b.totalPrice, 0)
      return { ...court, revenue: rev, occupancy: ocupacion.byCourt.get(court.id) ?? 0 }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const maxCourtRev = Math.max(...courtRevenue.map((c) => c.revenue), 1)

  return (
    <div className="min-h-screen" style={{ background: '#0a0810' }}>
      <SuperadminBanner
        clubId={id}
        clubName={club.name}
        zone={club.zone}
        courtCount={club._count.courts}
        isActive={club.isActive}
      />
      <div className="p-4 max-w-3xl mx-auto space-y-4 mt-4">
        <h2 className="font-semibold text-text">Analytics — últimos 30 días</h2>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Ingresos totales</p>
            <p className="font-mono font-bold text-accent text-lg">{formatPrice(ingresos.total)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Canchas</p>
            <p className="font-mono font-bold text-text text-lg">
              {formatPrice(ingresos.bookings)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Bar</p>
            <p className="font-mono font-bold text-text text-lg">{formatPrice(ingresos.bar)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Ocupación</p>
            <p className="font-display text-3xl text-text">{ocupacion.percentage}%</p>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm text-text mb-4">Últimos 7 días</h3>
          <div className="flex items-end gap-2 h-24">
            {semana.map((day) => {
              const maxVal = Math.max(...semana.map((d) => d.total), 1)
              const h = Math.round((day.total / maxVal) * 80)
              return (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${h}px`,
                        background: day.isToday ? 'rgba(168,85,247,0.7)' : 'rgba(168,85,247,0.25)',
                      }}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: day.isToday ? '#a855f7' : '#777' }}>
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Peak hours */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm text-text mb-3">Horarios pico</h3>
          <div className="space-y-1.5">
            {horarios
              .filter((h) => h.count > 0)
              .slice(0, 6)
              .map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted w-10 shrink-0">
                    {h.label.split('–')[0]}
                  </span>
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${h.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-6 text-right">{h.count}</span>
                </div>
              ))}
            {horarios.every((h) => h.count === 0) && (
              <p className="text-sm text-muted text-center py-3">Sin datos</p>
            )}
          </div>
        </div>

        {/* Court revenue */}
        {courtRevenue.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm text-text mb-3">Canchas por ingresos</h3>
            <div className="space-y-2">
              {courtRevenue.map((court, idx) => (
                <div key={court.id} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-4">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-sm text-text">{court.name}</span>
                      <span className="text-xs text-muted">{court.occupancy}% ocup.</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/60 rounded-full"
                        style={{ width: `${Math.round((court.revenue / maxCourtRev) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent w-20 text-right">
                    {formatPrice(court.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
