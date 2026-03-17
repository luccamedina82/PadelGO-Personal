import { requireRole } from '@/actions/auth'
import prisma from '@/lib/prisma'
import JugadoresClient from './JugadoresClient'

export default async function JugadoresPage() {
  const session = await requireRole(['OWNER'])

  const club = await prisma.club.findFirst({
    where: { ownerId: session.userId },
    select: { id: true, name: true },
  })

  if (!club) {
    return <div className="p-8 text-center text-muted">No tenés ningún club asignado.</div>
  }

  // Todos los usuarios con al menos una reserva no cancelada en el club
  const usersRaw = await prisma.user.findMany({
    where: {
      bookings: { some: { clubId: club.id, status: { not: 'CANCELLED' } } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarColor: true,
      isGhost: true,
      bookings: {
        where: { clubId: club.id, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          date: true,
          startTime: true,
          durationMinutes: true,
          totalPrice: true,
          paymentStatus: true,
          status: true,
          source: true,
          manualName: true,
        },
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  const players = usersRaw.map((u) => {
    const bookings = u.bookings
    const totalSpent = bookings
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + b.totalPrice, 0)
    const lastBooking = bookings[0] ?? null

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      avatarColor: u.avatarColor,
      isGhost: u.isGhost,
      totalBookings: bookings.length,
      totalSpent,
      lastBookingDate: lastBooking ? lastBooking.date.toISOString() : null,
      lastBookingTime: lastBooking?.startTime ?? null,
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date.toISOString(),
        startTime: b.startTime,
        durationMinutes: b.durationMinutes,
        totalPrice: b.totalPrice,
        paymentStatus: b.paymentStatus,
        status: b.status,
        source: b.source,
      })),
    }
  })

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 pt-4 pb-4">
        <h1 className="font-display text-2xl tracking-widest text-text">JUGADORES</h1>
        <p className="text-xs text-muted mt-1">{club.name}</p>
      </div>
      <JugadoresClient players={players} />
    </div>
  )
}
