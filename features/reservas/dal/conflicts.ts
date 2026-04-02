import prisma from '@/lib/prisma'
import { cacheTag, cacheLife } from 'next/cache'
import { argToday } from '@/lib/date'

export type ConflictType = 'MAINTENANCE' | 'ARCHIVED'

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

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Strip time component — compare dates at UTC midnight regardless of stored time */
function normDate(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export async function getConflictBookings(clubId: string): Promise<ConflictBooking[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`conflicts-${clubId}`)
  cacheTag(`bookings-${clubId}`)

  const today = argToday()

  const futureBookings = await prisma.booking.findMany({
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
  })

  const conflicts: ConflictBooking[] = []

  for (const b of futureBookings) {
    const playerName = b.manualName ?? b.user?.name ?? '—'
    const bookingDate = b.date instanceof Date ? b.date : new Date(b.date)
    const dateStr = toDateStr(bookingDate)

    if (!b.court.isActive) {
      conflicts.push({
        id: b.id, courtId: b.court.id, courtName: b.court.name, dateStr,
        startTime: b.startTime, durationMinutes: b.durationMinutes,
        playerName, status: b.status, conflictType: 'ARCHIVED',
      })
      continue
    }

    if (b.court.isUnderMaintenance) {
      conflicts.push({
        id: b.id, courtId: b.court.id, courtName: b.court.name, dateStr,
        startTime: b.startTime, durationMinutes: b.durationMinutes,
        playerName, status: b.status, conflictType: 'MAINTENANCE',
      })
    }
  }

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
    dateStr: toDateStr(b.date instanceof Date ? b.date : new Date(b.date)),
    startTime: b.startTime,
    durationMinutes: b.durationMinutes,
    playerName: b.manualName ?? b.user?.name ?? '—',
    cancelledAt: b.updatedAt,
  }))
}
