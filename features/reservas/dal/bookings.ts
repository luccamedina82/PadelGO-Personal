import prisma from '@/lib/prisma'
import { cacheLife, cacheTag, revalidateTag } from 'next/cache'
import { toUtcDateStr, argToday } from '@/lib/date'

// Internal cached fetch — pure read, no mutations
async function fetchBookingsFromDB(clubId: string, startDate: Date, endDate: Date) {
  'use cache'
  cacheLife('minutes')
  cacheTag(`bookings-${clubId}`)

  const rawBookings = await prisma.booking.findMany({
    where: {
      clubId: clubId,
      date: { gte: startDate, lte: endDate },
      status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] }, // CANCELLED excluded
    },
    select: {
      id: true,
      clubId: true,
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

  return rawBookings.map((b) => ({
    id: b.id,
    clubId: b.clubId,
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
    date: toUtcDateStr(b.date),
  }))
}

// Public function — runs lazy auto-complete before returning cached data
export const getAdminBookingsByDate = async (clubId: string, startDate: Date, endDate: Date) => {
  const today = argToday()

  // Argentina local time in minutes since midnight (UTC-3)
  const nowUtc = new Date()
  const argMinutes = ((nowUtc.getUTCHours() - 3 + 24) % 24) * 60 + nowUtc.getUTCMinutes()

  // 1. Past days: mark all CONFIRMED bookings from before today as COMPLETED
  const pastDays = await prisma.booking.updateMany({
    where: {
      clubId,
      status: 'CONFIRMED',
      date: { lt: today },
    },
    data: { status: 'COMPLETED' },
  })

  // 2. Today: mark CONFIRMED bookings whose end time has already passed
  const todayConfirmed = await prisma.booking.findMany({
    where: { clubId, status: 'CONFIRMED', date: today },
    select: { id: true, startTime: true, durationMinutes: true },
  })

  const pastTodayIds = todayConfirmed
    .filter((b) => {
      const [h = '0', m = '0'] = b.startTime.split(':')
      return parseInt(h) * 60 + parseInt(m) + b.durationMinutes <= argMinutes
    })
    .map((b) => b.id)

  if (pastTodayIds.length > 0) {
    await prisma.booking.updateMany({
      where: { id: { in: pastTodayIds } },
      data: { status: 'COMPLETED' },
    })
  }

  // Bust cache if anything changed so fetchBookingsFromDB returns fresh data
  if (pastDays.count > 0 || pastTodayIds.length > 0) {
    revalidateTag(`bookings-${clubId}`, 'default')
  }

  return fetchBookingsFromDB(clubId, startDate, endDate)
}
