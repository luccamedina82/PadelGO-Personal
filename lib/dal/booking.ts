import prisma from '@/lib/prisma'
import { cache } from 'react'

export const getAdminBookingsByDate = cache(async (clubId: string, startDate: Date, endDate: Date) => {
  const rawBookings = await prisma.booking.findMany({
    where: {
      clubId: clubId,
      date: { gte: startDate, lte: endDate },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      courtId: true,
      date: true,
      startTime: true,
      durationMinutes: true,
      status: true,
      source: true,
      totalPrice: true,
      paymentStatus: true,
      manualName: true,
      manualPhone: true,
      recurringBookingId: true,
      playerIds: true,
      paidPlayerIds: true,
      user: { select: { name: true } },
    },
  })

  const allPlayerIds = [...new Set(rawBookings.flatMap((b) => b.playerIds))]
  const playerList =
    allPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allPlayerIds } },
          select: { id: true, name: true },
        })
      : []
  const playerMap = new Map(playerList.map((p) => [p.id, p.name]))

  // Helper to format date from Date object
  function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return rawBookings.map((b) => ({
    id: b.id,
    courtId: b.courtId,
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    status: b.status,
    source: b.source,
    displayName:
      b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user?.name),
    totalPrice: b.totalPrice,
    paymentStatus: b.paymentStatus,
    manualPhone: b.manualPhone,
    user: b.user,
    court: {
        id: b.courtId,
    },
    manualName: b.manualName,
    recurringBookingId: b.recurringBookingId,
    playerDetails: b.playerIds.map((id) => ({ id, name: playerMap.get(id) ?? 'Jugador' })),
    paidPlayerIds: b.paidPlayerIds,
    date: formatDateStr(b.date),
  }))
}
)