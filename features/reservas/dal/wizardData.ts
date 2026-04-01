import { argToday } from '@/lib/date'
import { calcAvailableSlots } from '@/lib/availability'
import type { BookingRuleInput } from '@/lib/availability'
import { getCourtsByClubId } from './courts'
import { getAdminBookingsByDate } from './bookings'
import { prisma } from '@/lib/prisma'

export type CourtSlotsEntry = {
  courtId: string
  slots: {
    time: string
    available: boolean
    durationOptions: number[]
    pricePerHour: number
    appliedRuleName?: string
  }[]
}

export type WizardPageData = {
  courts: { id: string; name: string; type: string; covered: boolean }[]
  courtSlotsByDate: Record<string, CourtSlotsEntry[]>
  availableDates: string[]
  dateHasSlots: Record<string, boolean>
  durationOptions: number[]
}

export async function getWizardPageData(clubId: string, dateParam?: string): Promise<WizardPageData> {
  const clubConfig = await prisma.club.findUnique({
    where: { id: clubId },
    select: { bookingWindowDays: true },
  })

  const bookingWindowDays = clubConfig?.bookingWindowDays ?? 14
  const defaultDateOffset = dateParam
    ? Math.ceil(
        (new Date(`${dateParam}T00:00:00.000Z`).getTime() - argToday().getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1
    : 0
  const computationDays = Math.min(Math.max(bookingWindowDays, defaultDateOffset, 90), 180)

  const availableDates = Array.from({ length: computationDays }, (_, i) => {
    const d = new Date(argToday())
    d.setUTCDate(d.getUTCDate() + i)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  })

  const from = new Date(`${availableDates[0]}T00:00:00.000Z`)
  const to = new Date(`${availableDates[availableDates.length - 1]}T23:59:59.000Z`)

  const [{ courts, clubRules }, allBookings] = await Promise.all([
    getCourtsByClubId(clubId),
    getAdminBookingsByDate(clubId, from, to),
  ])

  const bookingsByKey = new Map<string, typeof allBookings>()
  for (const b of allBookings) {
    const key = `${b.courtId}:${b.date}`
    const existing = bookingsByKey.get(key)
    if (existing) existing.push(b)
    else bookingsByKey.set(key, [b])
  }

  const courtSlotsByDate: Record<string, CourtSlotsEntry[]> = {}

  for (const dateStr of availableDates) {
    const dObj = new Date(`${dateStr}T00:00:00.000Z`)
    const dow = dObj.getUTCDay()
    const dateSlots: CourtSlotsEntry[] = []

    for (const court of courts) {
      const avail = court.availabilities.find((a) => a.dayOfWeek === dow)
      if (!avail) {
        dateSlots.push({ courtId: court.id, slots: [] })
        continue
      }

      const combinedRules: BookingRuleInput[] = [
        ...clubRules,
        ...(court.bookingRule as BookingRuleInput[]),
      ]

      const courtBookings = bookingsByKey.get(`${court.id}:${dateStr}`) ?? []

      const slots = calcAvailableSlots(
        {
          openTime: avail.openTime,
          closeTime: avail.closeTime,
          pricePerHour: avail.pricePerHour,
          rules: combinedRules,
          isUnderMaintenance: court.isUnderMaintenance,
        },
        courtBookings,
        dObj,
        new Date(),
        0, // admin bypass: no advance time restriction
        'admin'
      )

      dateSlots.push({
        courtId: court.id,
        slots: slots.map((s) => ({
          time: s.time,
          available: s.available,
          durationOptions: s.durationOptions,
          pricePerHour: s.pricePerHour,
          appliedRuleName: s.appliedRuleName,
        })),
      })
    }
    courtSlotsByDate[dateStr] = dateSlots
  }

  const dateHasSlots: Record<string, boolean> = {}
  for (const [dateStr, slots] of Object.entries(courtSlotsByDate)) {
    dateHasSlots[dateStr] = slots.some((cs) => cs.slots.some((s) => s.available))
  }

  return {
    courts: courts.map((c) => ({ id: c.id, name: c.name, type: c.type, covered: c.covered })),
    courtSlotsByDate,
    availableDates,
    dateHasSlots,
    durationOptions: [60, 90, 120],
  }
}
