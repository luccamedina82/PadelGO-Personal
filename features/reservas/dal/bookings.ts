import prisma from '@/lib/prisma'
import { cacheLife, cacheTag } from 'next/cache'
import { toUtcDateStr, argToday } from '@/lib/date'
import { BookingBlock } from '../components/booking-grid/BookingGrid'

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

// Auto-complete (CONFIRMED → COMPLETED) is now handled by the cron job at
// /api/cron/booking-auto-complete — no longer runs on every SSR call.
export const getAdminBookingsByDate = (clubId: string, startDate: Date, endDate: Date) =>
  fetchBookingsFromDB(clubId, startDate, endDate)


export const getBookingsByDate = async (
  clubId: string, 
  startDate: Date, 
  endDate: Date
): Promise<BookingBlock[]> => {
  // 1. Lectura pura y dura (sin 'use cache')
  const rawBookings = await prisma.booking.findMany({
    where: {
      clubId: clubId,
      date: { gte: startDate, lte: endDate },
      status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] }, // Excluye CANCELLED
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

  // 2. Buscamos los nombres de los jugadores (excelente práctica)
  const allPlayerIds = [...new Set(rawBookings.flatMap((b) => b.playerIds))]
  const playerList = allPlayerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allPlayerIds } },
        select: { id: true, name: true },
      })
    : []
  const playerMap = new Map(playerList.map((p) => [p.id, p.name]))

  // Variables para el cálculo de estado en memoria (Opcional, pero recomendado para UI)
  const today = argToday()
  const nowUtc = new Date()
  const argMinutes = ((nowUtc.getUTCHours() - 3 + 24) % 24) * 60 + nowUtc.getUTCMinutes()

  // 3. Mapeo al tipo BookingBlock que espera tu UI
  return rawBookings.map((b) => {
    // Transformación de estado EN MEMORIA (No toca la DB)
    let displayStatus = b.status;
    if (displayStatus === 'CONFIRMED') {
      const isPastDay = b.date < today;
      const [h, m] = b.startTime.split(':').map(Number);
      const isPastTime = b.date.getTime() === today.getTime() && ((h * 60 + m + b.durationMinutes) <= argMinutes);
      
      if (isPastDay || isPastTime) {
        displayStatus = 'COMPLETED';
      }
    }

    return {
      id: b.id,
      clubId: b.clubId,
      courtId: b.courtId,
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      status: displayStatus, // Usamos el estado calculado arriba
      source: b.source as any, 
      displayName: b.source === 'BLOCK' ? (b.manualName ?? 'Bloqueo') : (b.manualName ?? b.user?.name ?? '—'),
      totalPrice: b.totalPrice,
      paymentStatus: b.paymentStatus as any,
      manualPhone: b.manualPhone,
      user: b.user,
      court: { id: b.courtId },
      manualName: b.manualName,
      recurringBookingId: b.recurringBookingId,
      playerDetails: b.playerIds.map((id) => ({ id, name: playerMap.get(id) ?? 'Jugador' })),
      paidPlayerIds: b.paidPlayerIds,
      date: toUtcDateStr(b.date), // Acá arreglamos el tema de la fecha string vs objeto
    }
  })
}