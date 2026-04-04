'use server'

import { getAdminContext } from '@/lib/dal/admin'
import { getCourtsByClubId } from '@/features/reservas/dal/courts'
import { getAdminBookingsByDate } from '@/features/reservas/dal/bookings'
import { calcAvailableSlots, timeToMinutes } from '@/lib/availability'
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
  const globalDurations = new Set<number>()
  for (const court of courts) {

    const combinedRules: BookingRuleInput[] = [...clubRules, ...(court.bookingRule as BookingRuleInput[])]
    const rulesForDay = combinedRules.filter((r) => r.daysOfWeek.includes(dow))

    // 2. Si no hay reglas, la cancha está cerrada
    if (rulesForDay.length === 0) {
      courtSlots.push({ courtId: court.id, slots: [] })
      continue
    }

    rulesForDay.forEach(r => r.allowedDurations.forEach(d => globalDurations.add(d)))

    const openMin = Math.min(...rulesForDay.map(r => timeToMinutes(r.startTime)))
    const closeMin = Math.max(...rulesForDay.map(r => timeToMinutes(r.endTime)))
    const openTime = `${String(Math.floor(openMin / 60)).padStart(2, '0')}:${String(openMin % 60).padStart(2, '0')}`
    const closeTime = `${String(Math.floor(closeMin / 60)).padStart(2, '0')}:${String(closeMin % 60).padStart(2, '0')}`
    
    const courtBookings = bookings.filter((b) => b.courtId === court.id)
    
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
      })),
    })
  }

  return { 
    courtSlots, 
    durationOptions: globalDurations.size > 0 
      ? Array.from(globalDurations).sort((a, b) => a - b) 
      : []
  }
}
