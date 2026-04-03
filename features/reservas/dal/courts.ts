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
        isUnderMaintenance: true,
        hideFromGrid: true,
        availabilities: {
          where: { isActive: true },
          select: {
            dayOfWeek: true,
            openTime: true,
            closeTime: true,
            pricePerHour: true,
            isActive: true,
          },
        },
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
