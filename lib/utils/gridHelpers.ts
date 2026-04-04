import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'

export function prepareGridData(
  allCourts: any[], 
  clubRules: any[], 
  baseBookingRule: any, 
  dayOfWeek: number
) {
  const activeCourtsToday = allCourts.map((court) => ({
    ...court,
    availabilities: court.availabilities.filter((a: any) => a.dayOfWeek === dayOfWeek),
  }))

  let baseStart = 8 * 60
  let baseEnd = 23 * 60

  if (baseBookingRule) {
    const [sh, sm] = baseBookingRule.startTime.split(':').map(Number)
    const [eh, em] = baseBookingRule.endTime.split(':').map(Number)
    baseStart = (sh ?? 8) * 60 + (sm ?? 0)
    baseEnd = (eh ?? 23) * 60 + (em ?? 0)
  }

  const clubAllowedDurations = [...new Set(clubRules.flatMap((r: any) => r.allowedDurations))].sort((a, b) => a - b)

  const courtColumns: CourtColumn[] = activeCourtsToday
    .filter((c) => !c.hideFromGrid)
    .map((c) => {
      let closeTimeMinutes: number | undefined
      let openTimeMinutes: number | undefined
      
      if (c.availabilities.length > 0) {
        const closeTimes = c.availabilities.map((a: any) => {
          const [h, m] = a.closeTime.split(':').map(Number)
          return (h ?? 23) * 60 + (m ?? 0)
        })
        const openTimes = c.availabilities.map((a: any) => {
          const [h, m] = a.openTime.split(':').map(Number)
          return (h ?? 8) * 60 + (m ?? 0)
        })
        closeTimeMinutes = Math.min(...closeTimes)
        openTimeMinutes = Math.min(...openTimes)
      }
      
      const courtRuleDurations = [...new Set((c.bookingRule as any[]).flatMap((r: any) => r.allowedDurations as number[]))].sort((a: number, b: number) => a - b)
      const allowedDurations = courtRuleDurations.length > 0
        ? courtRuleDurations
        : clubAllowedDurations.length > 0
          ? clubAllowedDurations
          : [60, 90, 120]
          
      return {
        id: c.id,
        name: c.name,
        isActive: c.availabilities.length > 0,
        isUnderMaintenance: c.isUnderMaintenance,
        hideFromGrid: c.hideFromGrid,
        closeTimeMinutes,
        openTimeMinutes,
        allowedDurations,
      }
    })

  return { courtColumns, baseStart, baseEnd }
}