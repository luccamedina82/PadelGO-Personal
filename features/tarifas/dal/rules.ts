import prisma from '@/lib/prisma'
import { cacheTag, cacheLife } from 'next/cache'

export interface BookingRuleRow {
  id: string
  name: string
  priority: number
  daysOfWeek: number[]
  startTime: string
  endTime: string
  price: number | null
  intervalMinutes: number
  allowedDurations: number[]
  isActive: boolean
  courtIds: string[]
  activeFrom: Date | null
  activeUntil: Date | null
  createdAt: Date
}

export async function getRulesByClubId(clubId: string): Promise<BookingRuleRow[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`rules-${clubId}`)

  return prisma.bookingRule.findMany({
    where: { clubId },
    select: {
      id: true,
      name: true,
      priority: true,
      daysOfWeek: true,
      startTime: true,
      endTime: true,
      price: true,
      intervalMinutes: true,
      allowedDurations: true,
      isActive: true,
      courtIds: true,
      activeFrom: true,
      activeUntil: true,
      createdAt: true,
    },
    orderBy: { priority: 'desc' },
  })
}
