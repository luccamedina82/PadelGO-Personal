import { requireSuperAdmin } from '@/actions/auth'
import prisma from '@/lib/prisma'
import UserActions from '../UserActions'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatPrice } from '@/lib/availability'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SuperadminUserDetailPage({ params }: Props) {
  await requireSuperAdmin()

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      zone: true,
      level: true,
      matchesPlayed: true,
      matchesWon: true,
      streak: true,
      role: true,
      isActive: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      avatarColor: true,
      createdAt: true,
      lastPlayedAt: true,
    },
  })

  if (!user) notFound()

  const bookings = await prisma.booking.findMany({
    where: { userId: id },
    include: {
      club: { select: { name: true } },
      court: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 20,
  })

  const bookingsForClient = bookings.map((b) => ({
    id: b.id,
    clubName: b.club.name,
    courtName: b.court.name,
    date: b.date.toISOString().split('T')[0] ?? '',
    startTime: b.startTime,
    status: b.status,
    totalPrice: b.totalPrice,
  }))

  const totalSpent = bookings
    .filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED')
    .reduce((s, b) => s + b.totalPrice, 0)

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto" style={{ background: '#0a0810' }}>
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/superadmin/users"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          ← Volver a usuarios
        </Link>
      </div>

      {/* User header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
          style={{ backgroundColor: user.avatarColor + '33', color: user.avatarColor }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl text-text tracking-wide">{user.name}</h1>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded border"
              style={{
                color: '#a855f7',
                borderColor: 'rgba(168,85,247,0.3)',
                background: 'rgba(168,85,247,0.08)',
              }}
            >
              {user.role}
            </span>
            {user.isBanned && (
              <span className="text-xs font-bold px-2 py-0.5 rounded text-red-400 bg-red-400/10">
                BANEADO
              </span>
            )}
            {!user.isActive && (
              <span className="text-xs font-bold px-2 py-0.5 rounded text-muted bg-muted/10">
                INACTIVO
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-0.5">{user.email}</p>
          {user.phone && <p className="text-sm text-muted">{user.phone}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Stats */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Información</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Zona</span>
              <span className="text-text">{user.zone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Nivel</span>
              <span className="font-mono text-text">{user.level.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Partidos jugados</span>
              <span className="text-text">{user.matchesPlayed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Victorias</span>
              <span className="text-text">{user.matchesWon}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Racha actual</span>
              <span className="text-text">{user.streak} días</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Último partido</span>
              <span className="text-text">
                {user.lastPlayedAt ? new Date(user.lastPlayedAt).toLocaleDateString('es-AR') : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Reservas totales</span>
              <span className="text-text">{bookings.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Total gastado</span>
              <span className="font-mono text-accent">{formatPrice(totalSpent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Miembro desde</span>
              <span className="text-text">
                {new Date(user.createdAt).toLocaleDateString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-sm text-text mb-3">Acciones de soporte</h2>
          <UserActions
            userId={user.id}
            isActive={user.isActive}
            isBanned={user.isBanned}
            bannedReason={user.bannedReason}
            bookings={bookingsForClient}
          />
        </div>
      </div>
    </div>
  )
}
