import type { CourtColumn } from '@/features/reservas/components/booking-grid/BookingGrid'
import { timeToMinutes } from '../availability'

export function prepareGridData(
  allCourts: any[], 
  clubRules: any[], 
  baseBookingRule: any, 
  dayOfWeek: number
) {
  let baseStart = 8 * 60
  let baseEnd = 23 * 60

  if (baseBookingRule) {
    baseStart = timeToMinutes(baseBookingRule.startTime)
    baseEnd = timeToMinutes(baseBookingRule.endTime)
  }
  const courtColumns: CourtColumn[] = allCourts
    .filter((c) => !c.hideFromGrid)
    .map((c) => {
      const courtSpecificRules = c.bookingRule || []
      const combinedRules = [...clubRules, ...courtSpecificRules]
      const rulesForToday = combinedRules.filter((r: any) => {
        const appliesToDay = r.daysOfWeek?.includes(dayOfWeek)
        const appliesToCourt = !r.courtIds || r.courtIds.length === 0 || r.courtIds.includes(c.id)
        return appliesToDay && appliesToCourt
      })

      let closeTimeMinutes: number | undefined
      let openTimeMinutes: number | undefined

      if (rulesForToday.length > 0) {
        openTimeMinutes = Math.min(...rulesForToday.map((r: any) => timeToMinutes(r.startTime)))
        closeTimeMinutes = Math.max(...rulesForToday.map((r: any) => timeToMinutes(r.endTime)))
      }
      return {
        id: c.id,
        name: c.name,
        isActive: c.isActive && rulesForToday.length > 0,
        isUnderMaintenance: c.isUnderMaintenance,
        hideFromGrid: c.hideFromGrid,
        closeTimeMinutes,
        openTimeMinutes,
        adminAllowedDurations: baseBookingRule?.allowedDurations,
      }
    })
  return { courtColumns, baseStart, baseEnd }
}
