'use server'

import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { calcAvailableSlots } from '@/lib/availability'
import type { BookingRuleInput } from '@/lib/availability'

export type FloatingFormSlot = {
  time: string
  available: boolean
  durationOptions: number[]
  pricePerHour: number
  appliedRuleName?: string
}

export type FloatingFormCourtSlots = {
  courtId: string
  slots: FloatingFormSlot[]
}

export type FloatingFormData = {
  courtSlots: FloatingFormCourtSlots[]
  durationOptions: number[]
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
    const avail = court.availabilities.find((a) => a.dayOfWeek === dow)
    if (!avail) {
      courtSlots.push({ courtId: court.id, slots: [] })
      continue
    }
    const combinedRules: BookingRuleInput[] = [...clubRules, ...(court.bookingRule as BookingRuleInput[])]
    const courtBookings = bookings.filter((b) => b.courtId === court.id)

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
      })),
    })
  }

  return { courtSlots, durationOptions: [60, 90, 120] }
}
