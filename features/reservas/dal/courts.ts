import prisma from '@/lib/prisma'
import { cacheTag, cacheLife } from 'next/cache'
import type { BookingRuleInput } from '@/lib/availability'

const RULE_SELECT = {
  name: true,
  priority: true,
  daysOfWeek: true,
  startTime: true,
  endTime: true,
  price: true,
  intervalMinutes: true,
  allowedDurations: true,
  courtIds: true,
  activeFrom: true,
  activeUntil: true,
  onlineStartTime: true,
  onlineEndTime: true,
} as const

export async function getCourtsByClubId(clubId: string) {
  'use cache'
  cacheLife('days')
  cacheTag(`courts-${clubId}`)
  cacheTag(`rules-${clubId}`)

  const [rawCourts, allRules] = await Promise.all([
    prisma.court.findMany({
      where: { clubId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        covered: true,
        isActive: true,
        isUnderMaintenance: true,
        hideFromGrid: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.bookingRule.findMany({
      where: { clubId, isActive: true },
      select: RULE_SELECT,
    }),
  ])

  const clubRules = allRules
    .filter((r) => r.courtIds.length === 0)
    .map(({ courtIds: _courtIds, ...rest }) => rest)

  const courts = rawCourts.map((court) => ({
    ...court,
    bookingRule: allRules
      .filter((r) => r.courtIds.includes(court.id))
      .map(({ courtIds: _courtIds, ...rest }) => rest),
  }))
  return { courts, clubRules: clubRules as BookingRuleInput[] }
}



export async function getBaseBookingRule(clubId: string, selectedDate: string) {
  'use cache'
  cacheLife('days')
  cacheTag(`courts-${clubId}`)
  cacheTag(`rules-${clubId}`)

  return await prisma.bookingRule.findFirst({
    where: {
      clubId,
      priority: 0,
      isActive: true,
      courtIds: { isEmpty: true },
      AND: [
        { OR: [{ activeFrom: null }, { activeFrom: { lte: new Date(`${selectedDate}T23:59:59.999Z`) } }] },
        { OR: [{ activeUntil: null }, { activeUntil: { gte: new Date(`${selectedDate}T00:00:00.000Z`) } }] },
      ],
    },
    orderBy: { activeFrom: 'desc' },
    select: RULE_SELECT,
  })
}

/**
 * Fetches base booking rules for a week in a single query.
 * Replaces 7 individual getBaseBookingRule calls with 1 DB roundtrip.
 * Returns a map of dateStr → rule (or null if none applies).
 */
export async function getBaseBookingRulesForWeek(
  clubId: string,
  weekDays: string[]
) {
  'use cache'
  cacheLife('days')
  cacheTag(`courts-${clubId}`)
  cacheTag(`rules-${clubId}`)

  const weekStart = new Date(`${weekDays[0]}T00:00:00.000Z`)
  const weekEnd = new Date(`${weekDays[weekDays.length - 1]}T23:59:59.999Z`)

  // Fetch all candidate base rules that overlap this week at all
  const candidates = await prisma.bookingRule.findMany({
    where: {
      clubId,
      priority: 0,
      isActive: true,
      courtIds: { isEmpty: true },
      AND: [
        { OR: [{ activeFrom: null }, { activeFrom: { lte: weekEnd } }] },
        { OR: [{ activeUntil: null }, { activeUntil: { gte: weekStart } }] },
      ],
    },
    orderBy: { activeFrom: 'desc' },
    select: RULE_SELECT,
  })

  // For each day, resolve which rule applies (same logic as getBaseBookingRule, in JS)
  return weekDays.map((day) => {
    const dayStart = new Date(`${day}T00:00:00.000Z`)
    const dayEnd = new Date(`${day}T23:59:59.999Z`)
    return (
      candidates.find((r) => {
        const fromOk = r.activeFrom == null || r.activeFrom <= dayEnd
        const untilOk = r.activeUntil == null || r.activeUntil >= dayStart
        return fromOk && untilOk
      }) ?? null
    )
  })
}