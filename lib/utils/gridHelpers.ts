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


// import { BookingRule, Court, CourtType } from '@/app/generated/prisma/browser'
// import { timeToMinutes } from '@/lib/availability'
// // Importá tus tipos de Prisma o los que uses (Court, BookingRule, CourtColumn)
// interface rawCourts {
//         id: string,
//         name: string,
//         // Si la cancha está inactiva globalmente, o si no tiene reglas para hoy, la marcamos inactiva (fondo oscuro)
//         isActive: boolean,
//         isUnderMaintenance: boolean,
//         openTimeMinutes: number,
//         closeTimeMinutes: number,
//         allowedDurations: number[],
//       }
// export function prepareGridData1(
//   rawCourts: any[],  
//   rawRules: any[], 
//   targetDateStr: number // formato "YYYY-MM-DD"
// ): rawCourts[]{
  
//   // 1. Calculamos qué día de la semana es hoy (0 = Domingo, 1 = Lunes...)
//   // Aseguramos de parsear bien la fecha sin problemas de zona horaria local
//   const targetDate = new Date(`${targetDateStr}T12:00:00`) 
//   const dayOfWeek = targetDate.getDay()

//   const pepe = rawCourts
//     .filter(court => !court.hideFromGrid) // Filtro básico
//     .map(court => {
//       // 2. Filtramos TODAS las reglas que aplican a ESTA cancha, ESTE día
//       const courtRulesToday = rawRules.filter(rule => {
//         const isRuleActive = rule.isActive
//         const appliesToDay = rule.daysOfWeek.includes(dayOfWeek)
//         const appliesToCourt = rule.courtIds?.length === 0 || rule.courtIds?.includes(court.id)
        
//         // Verificamos vigencia (activeFrom / activeUntil)
//         const isStarted = !rule.activeFrom || new Date(rule.activeFrom) <= targetDate
//         const isNotExpired = !rule.activeUntil || new Date(rule.activeUntil) >= targetDate

//         return isRuleActive && appliesToDay && appliesToCourt && isStarted && isNotExpired
//       })

//       // 3. Valores por defecto (si la cancha está cerrada hoy)
//       let openTimeMinutes = 0
//       let closeTimeMinutes = 0
//       let allowedDurations: number[] = [] // Fallback ultra-seguro
//       let isClosedToday = courtRulesToday.length === 0

//       // 4. Si hay reglas, calculamos los extremos y las duraciones
//       if (!isClosedToday) {
//         // Horario de apertura: El más temprano de todas las reglas de hoy
//         openTimeMinutes = Math.min(...courtRulesToday.map(r => timeToMinutes(r.startTime)))
        
//         // Horario de cierre: El más tardío de todas las reglas de hoy
//         closeTimeMinutes = Math.max(...courtRulesToday.map(r => timeToMinutes(r.endTime)))

//         // Duraciones permitidas: Unimos todas las duraciones de las reglas que aplican y sacamos duplicados
//         const allDurations = courtRulesToday.flatMap(r => r.allowedDurations)
//         allowedDurations = [...new Set(allDurations)].sort((a, b) => a - b)
//       }

//       // 5. Devolvemos el objeto CourtColumn perfecto para tu grilla
//       return {
//         id: court.id,
//         name: court.name,
//         // Si la cancha está inactiva globalmente, o si no tiene reglas para hoy, la marcamos inactiva (fondo oscuro)
//         isActive: court.isActive && !isClosedToday,
//         isUnderMaintenance: court.isUnderMaintenance,
//         openTimeMinutes,
//         closeTimeMinutes,
//         allowedDurations,
//       }
//     })
//   return pepe
// }