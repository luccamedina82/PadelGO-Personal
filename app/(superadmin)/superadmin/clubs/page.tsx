import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import ClubsShell from './ClubsShell'
import { argToday, argTomorrow } from '@/lib/date'

interface Props {
  searchParams: Promise<{ q?: string; filter?: string }>
}

export default async function SuperadminClubsPage({ searchParams }: Props) {
  await requireSuperAdmin()

  const { q, filter } = await searchParams

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { zone: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(filter === 'active' ? { isActive: true } : {}),
    ...(filter === 'inactive' ? { isActive: false } : {}),
  }

  const clubs = await prisma.club.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { courts: true, bookings: true } },
    },
    orderBy: { name: 'asc' },
  })

  const today = argToday()
  const tomorrow = argTomorrow()

  const todayBookingsByClub = await prisma.booking.groupBy({
    by: ['clubId'],
    where: {
      date: { gte: today, lt: tomorrow },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
    _count: { _all: true },
  })

  const bookingMap = new Map(todayBookingsByClub.map((b) => [b.clubId, b._count._all]))

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto" style={{ background: '#0a0810' }}>
      <ClubsShell>
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <form className="flex-1">
            <input
              name="q"
              defaultValue={q}
              type="search"
              placeholder="Buscar por nombre, zona o email..."
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-sub focus:outline-none focus:border-border-hover"
            />
          </form>
          <div className="flex gap-2">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <Link
                key={f}
                href={`/superadmin/clubs${f !== 'all' ? `?filter=${f}` : ''}${q ? `${f !== 'all' ? '&' : '?'}q=${q}` : ''}`}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  (filter ?? 'all') === f
                    ? 'border-[#a855f7] text-[#a855f7] bg-[#a855f7]/10 font-medium'
                    : 'border-border text-muted hover:text-text hover:bg-card'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
              </Link>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted">
              {clubs.length} club{clubs.length !== 1 ? 'es' : ''}
            </p>
          </div>
          {clubs.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">No se encontraron clubes</div>
          ) : (
            <div className="divide-y divide-border">
              {clubs.map((club) => {
                const todayCount = bookingMap.get(club.id) ?? 0
                return (
                  <div
                    key={club.id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-card-hover transition-colors ${
                      !club.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Club info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
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
                      <p className="text-xs text-muted truncate">{club.email}</p>
                    </div>

                    {/* Zone */}
                    <div className="hidden md:block w-24 shrink-0">
                      <p className="text-xs text-muted">{club.zone}</p>
                    </div>

                    {/* Owner */}
                    <div className="hidden lg:block w-36 shrink-0">
                      <p className="text-xs text-text truncate">{club.owner.name}</p>
                      <p className="text-xs text-sub truncate">{club.owner.email}</p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-xs font-bold text-text">{club._count.courts}</p>
                        <p className="text-[10px] text-sub">canchas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-text">{todayCount}</p>
                        <p className="text-[10px] text-sub">res. hoy</p>
                      </div>
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/superadmin/clubs/${club.id}`}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                      style={{
                        borderColor: 'rgba(168,85,247,0.4)',
                        color: '#a855f7',
                      }}
                    >
                      Ver club →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ClubsShell>
    </div>
  )
}
