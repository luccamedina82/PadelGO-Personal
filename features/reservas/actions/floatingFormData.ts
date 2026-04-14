'use server'

import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { calcAvailableSlots, getRulesTimeBounds, minutesToTime } from '@/lib/availability'
import type { BookingRuleInput } from '@/lib/availability'

export type FloatingFormSlot = {
  time: string
  available: boolean
  durationOptions: number[]
  pricePerHour: number
  appliedRuleName?: string
  bookingStartsAt?: boolean
}

export type FloatingFormCourtSlots = {
  courtId: string
  slots: FloatingFormSlot[]
}

export type FloatingFormData = {
  courtSlots: FloatingFormCourtSlots[]
}

export async function getFloatingFormDataAction(
  clubId: string,
  date: string
): Promise<FloatingFormData | null> {
  const { club } = await getAdminContext(['OWNER', 'STAFF'])
  if (!club || club.id !== clubId) return null

  const dObj = new Date(`${date}T00:00:00.000Z`)
  const dow = dObj.getUTCDay()

  const [{ courts, clubRules }, bookings] = await Promise.all([
    getCourtsByClubId(clubId),
    getAdminBookingsByDate(clubId, dObj, new Date(`${date}T23:59:59.999Z`)),
  ])

  const courtSlots: FloatingFormCourtSlots[] = []
  for (const court of courts) {

    const combinedRules: BookingRuleInput[] = [...clubRules, ...(court.bookingRule as BookingRuleInput[])]
    const rulesForDay = combinedRules.filter((r) => r.daysOfWeek.includes(dow))

    // 2. Si no hay reglas, la cancha está cerrada
    if (rulesForDay.length === 0) {
      courtSlots.push({ courtId: court.id, slots: [] })
      continue
    }

    const { openMin, closeMin } = getRulesTimeBounds(rulesForDay)
    const openTime = minutesToTime(openMin)
    const closeTime = minutesToTime(closeMin)
    
    const courtBookings = bookings.filter((b) => b.courtId === court.id)
    const activeBookingStartTimes = new Set(
      courtBookings
        .filter((b) => b.status === 'PENDING' || b.status === 'CONFIRMED')
        .map((b) => b.startTime)
    )

    const slots = calcAvailableSlots(
      {
        openTime: openTime,
        closeTime: closeTime,
        pricePerHour: 0,
        rules: rulesForDay,
        isUnderMaintenance: court.isUnderMaintenance,
      },
      courtBookings,
      dObj,
      new Date(),
      0,
      'admin'
    )

    courtSlots.push({
      courtId: court.id,
      slots: slots.map((s) => ({
        time: s.time,
        available: s.available,
        durationOptions: s.durationOptions,
        pricePerHour: s.pricePerHour,
        appliedRuleName: s.appliedRuleName,
        bookingStartsAt: activeBookingStartTimes.has(s.time),
      })),
    })
  }

  return { courtSlots }
}
