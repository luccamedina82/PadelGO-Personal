import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import SuperadminBanner from '@/components/layout/SuperadminBanner'
import { formatPrice } from '@/lib/availability'
import { periodToday, calcularIngresos } from '@/lib/analytics'
import { argToday, argTomorrow } from '@/lib/date'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

const SUB_TABS = [
  { label: 'Reservas', href: 'reservas' },
  { label: 'Canchas', href: 'canchas' },
  { label: 'Horarios', href: 'horarios' },
  { label: 'Equipo', href: 'equipo' },
  { label: 'Analytics', href: 'analytics' },
]

export default async function SuperadminClubDetailPage({ params }: Props) {
  await requireSuperAdmin()

  const { id } = await params

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      courts: { select: { id: true, name: true, isActive: true } },
      _count: { select: { staffUsers: true } },
    },
  })

  if (!club) notFound()

  const today = argToday()
  const tomorrow = argTomorrow()

  const [todayBookings, todayBarSales] = await Promise.all([
    prisma.booking.findMany({
      where: { clubId: id, date: { gte: today, lt: tomorrow } },
      select: {
        totalPrice: true,
        status: true,
        source: true,
        startTime: true,
        durationMinutes: true,
      },
    }),
    prisma.barSale.findMany({
      where: { clubId: id, createdAt: { gte: today, lt: tomorrow } },
      select: { total: true },
    }),
  ])

  const period = periodToday()
  const ingresos = calcularIngresos(
    todayBookings.map((b) => ({
      date: today,
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      totalPrice: b.totalPrice,
      status: b.status,
      source: b.source,
      courtId: '',
    })),
    todayBarSales.map((s) => ({ createdAt: new Date(), total: s.total })),
    period
  )

  const confirmedToday = todayBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED'
  ).length

  const activeCourts = club.courts.filter((c) => c.isActive).length

  return (
    <div className="min-h-screen" style={{ background: '#0a0810' }}>
      <SuperadminBanner
        clubId={id}
        clubName={club.name}
        zone={club.zone}
        courtCount={club.courts.length}
        isActive={club.isActive}
      />

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Club header */}
        <div className="mb-5">
          <h1 className="font-display text-3xl text-text tracking-wide uppercase">{club.name}</h1>
          <p className="text-sm text-muted mt-0.5">
            {club.address} · {club.zone}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Reservas hoy</p>
            <p className="font-display text-3xl text-text">{confirmedToday}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Ingresos hoy</p>
            <p className="font-mono text-lg font-bold text-accent">{formatPrice(ingresos.total)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Canchas activas</p>
            <p className="font-display text-3xl text-text">{activeCourts}</p>
            <p className="text-xs text-muted mt-0.5">de {club.courts.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Owner</p>
            <p className="text-sm text-text font-medium truncate">{club.owner.name}</p>
            <p className="text-xs text-muted truncate">{club.owner.email}</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 mb-5 bg-card border border-border rounded-xl p-1 overflow-x-auto">
          {SUB_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={`/superadmin/clubs/${id}/${tab.href}`}
              className="flex-1 text-center text-sm py-2 rounded-lg text-muted hover:text-text hover:bg-card-hover transition-colors whitespace-nowrap px-2"
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Club detail info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm text-text mb-3">Información del club</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Nombre</span>
                <span className="text-text">{club.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Zona</span>
                <span className="text-text">{club.zone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Dirección</span>
                <span className="text-text text-right max-w-[200px] truncate">{club.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Teléfono</span>
                <span className="text-text">{club.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email</span>
                <span className="text-text truncate max-w-[200px]">{club.email}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold text-sm text-text mb-3">Canchas</h2>
            <div className="space-y-1.5">
              {club.courts.length === 0 ? (
                <p className="text-sm text-muted">Sin canchas configuradas</p>
              ) : (
                club.courts.map((court) => (
                  <div key={court.id} className="flex items-center justify-between">
                    <span className="text-sm text-text">{court.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        court.isActive ? 'text-green-400 bg-green-400/10' : 'text-muted bg-muted/10'
                      }`}
                    >
                      {court.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <Link
                href={`/superadmin/clubs/${id}/canchas`}
                className="text-xs hover:underline"
                style={{ color: 'rgba(168,85,247,0.8)' }}
              >
                Gestionar canchas →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
