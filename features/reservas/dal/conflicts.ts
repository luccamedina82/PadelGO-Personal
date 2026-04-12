import prisma from '@/lib/prisma'
import { cacheTag, cacheLife } from 'next/cache'
import { argToday, toUtcDateStr } from '@/lib/date'

export type ConflictType = 'MAINTENANCE' | 'ARCHIVED' | 'OUT_OF_HOURS'

export interface ConflictBooking {
  id: string
  courtId: string
  courtName: string
  dateStr: string // "YYYY-MM-DD"
  startTime: string
  durationMinutes: number
  playerName: string
  status: string
  conflictType: ConflictType
}

export interface CancelledBooking {
  id: string
  courtName: string
  dateStr: string
  startTime: string
  durationMinutes: number
  playerName: string
  cancelledAt: Date
}


export async function getConflictBookings(clubId: string): Promise<ConflictBooking[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`conflicts-${clubId}`)
  cacheTag(`bookings-${clubId}`)

  const today = argToday()

  const [futureBookings, oohBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        clubId,
        date: { gte: today },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        durationMinutes: true,
        status: true,
        manualName: true,
        court: {
          select: { id: true, name: true, isActive: true, isUnderMaintenance: true },
        },
        user: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.booking.findMany({
      where: {
        clubId,
        outOfHoursWarning: true,
        exceptionApprovedAt: null,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        durationMinutes: true,
        status: true,
        manualName: true,
        court: { select: { id: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const conflicts: ConflictBooking[] = []
  const seenIds = new Set<string>()

  for (const b of futureBookings) {
    const playerName = b.manualName ?? b.user?.name ?? '—'
    const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
    const dateStr = toUtcDateStr(bookingDate)

    if (!b.court.isActive) {
      conflicts.push({
        id: b.id, courtId: b.court.id, courtName: b.court.name, dateStr,
        startTime: b.startTime, durationMinutes: b.durationMinutes,
        playerName, status: b.status, conflictType: 'ARCHIVED',
      })
      seenIds.add(b.id)
      continue
    }

    if (b.court.isUnderMaintenance) {
      conflicts.push({
        id: b.id, courtId: b.court.id, courtName: b.court.name, dateStr,
        startTime: b.startTime, durationMinutes: b.durationMinutes,
        playerName, status: b.status, conflictType: 'MAINTENANCE',
      })
      seenIds.add(b.id)
    }
  }

  // Add out-of-hours warnings that aren't already listed under a court conflict
  for (const b of oohBookings) {
    if (seenIds.has(b.id)) continue
    const playerName = b.manualName ?? b.user?.name ?? '—'
    const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
    const dateStr = toUtcDateStr(bookingDate)
    if (Date.UTC(bookingDate.getUTCFullYear(), bookingDate.getUTCMonth(), bookingDate.getUTCDate()) < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) continue // ignore past
    conflicts.push({
      id: b.id, courtId: b.court.id, courtName: b.court.name, dateStr,
      startTime: b.startTime, durationMinutes: b.durationMinutes,
      playerName, status: b.status, conflictType: 'OUT_OF_HOURS',
    })
  }

  conflicts.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  return conflicts
}

export async function getRecentCancellations(clubId: string): Promise<CancelledBooking[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`cancellations-${clubId}`)
  cacheTag(`bookings-${clubId}`)

  const rows = await prisma.booking.findMany({
    where: { clubId, status: 'CANCELLED' },
    select: {
      id: true,
      date: true,
      startTime: true,
      durationMinutes: true,
      updatedAt: true,
      manualName: true,
      court: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return rows.map((b) => ({
    id: b.id,
    courtName: b.court.name,
    dateStr: toUtcDateStr(b.date instanceof Date ? b.date : new Date(b.date)),
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    playerName: b.manualName ?? b.user?.name ?? '—',
    cancelledAt: b.updatedAt,
  }))
}
