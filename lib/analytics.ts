/**
 * lib/analytics.ts — Club analytics calculations.
 *
 * C-01: Zero Next.js imports. Framework-agnostic pure functions.
 * All functions receive data as parameters — no DB access here.
 * DB queries happen in Server Actions / Server Components, then results
 * are passed to these functions for calculation.
 */

import { argToday, argTomorrow, argTodayStr } from '@/lib/date'

// ── TYPES ──────────────────────────────────────────────────────────────────

export interface BookingRecord {
  date: Date
  startTime: string // "HH:MM"
  durationMinutes: number
  totalPrice: number // centavos
  status: string // "CONFIRMED" | "COMPLETED" | etc.
  source: string // "ONLINE" | "MANUAL_OWNER" | etc.
  courtId: string
}



export interface BarSaleRecord {
  createdAt: Date
  total: number // centavos
}

export interface CourtRecord {
  id: string
  name: string
}

export interface AvailabilityRecord {
  courtId: string
  dayOfWeek: number // 0–6
  openTime: string
  closeTime: string
  isActive: boolean
}

export interface AnalyticsPeriod {
  start: Date
  end: Date
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function isInPeriod(date: Date, period: AnalyticsPeriod): boolean {
  return date >= period.start && date < period.end
}

function minutesBetween(openTime: string, closeTime: string): number {
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  return ch * 60 + cm - (oh * 60 + (om ?? 0))
}

// ── INGRESOS ───────────────────────────────────────────────────────────────

export interface IngresosResult {
  /** Suma de Booking.totalPrice donde status=CONFIRMED|COMPLETED (centavos) */
  bookings: number
  /** Suma de BarSale.total para el período (centavos) */
  bar: number
  /** bookings + bar */
  total: number
}

/**
 * Calculate revenue for a period.
 * @param bookings  Booking records for the club (any status)
 * @param barSales  BarSale records for the club
 * @param period    Date range [start, end)
 */
export function calcularIngresos(
  bookings: BookingRecord[],
  barSales: BarSaleRecord[],
  period: AnalyticsPeriod
): IngresosResult {
  const bookingRevenue = bookings
    .filter(
      (b) =>
        isInPeriod(b.date, period) &&
        (b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'PENDING')
    )
    .reduce((sum, b) => sum + b.totalPrice, 0)

  const barRevenue = barSales
    .filter((s) => isInPeriod(s.createdAt, period))
    .reduce((sum, s) => sum + s.total, 0)

  return {
    bookings: bookingRevenue,
    bar: barRevenue,
    total: bookingRevenue + barRevenue,
  }
}

// ── OCUPACION ──────────────────────────────────────────────────────────────

export interface OcupacionResult {
  /** Total slots posibles en el período (minutos) */
  totalMinutes: number
  /** Slots ocupados (minutos de reservas CONFIRMED|COMPLETED) */
  occupiedMinutes: number
  /** Porcentaje de ocupacion (0–100) */
  percentage: number
  /** Por cancha: Map<courtId, percentage> */
  byCourt: Map<string, number>
}

/**
 * Calculate occupancy for a period.
 * @param bookings      Booking records (CONFIRMED or COMPLETED count as occupied)
 * @param courts        Active courts for the club
 * @param availabilities CourtAvailability records
 * @param period        Date range [start, end)
 */
export function calcularOcupacion(
  bookings: BookingRecord[],
  courts: CourtRecord[],
  availabilities: AvailabilityRecord[],
  period: AnalyticsPeriod
): OcupacionResult {
  // Calculate total available minutes per court per day in the period
  const days: Date[] = []
  const cursor = new Date(period.start)
  while (cursor < period.end) {
    days.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  let totalMinutes = 0
  const totalPerCourt = new Map<string, number>()
  const occupiedPerCourt = new Map<string, number>()

  for (const court of courts) {
    totalPerCourt.set(court.id, 0)
    occupiedPerCourt.set(court.id, 0)

    for (const day of days) {
      const dow = day.getUTCDay()
      const avail = availabilities.find(
        (a) => a.courtId === court.id && a.dayOfWeek === dow && a.isActive
      )
      if (!avail) continue

      const mins = minutesBetween(avail.openTime, avail.closeTime)
      const current = totalPerCourt.get(court.id) ?? 0
      totalPerCourt.set(court.id, current + mins)
      totalMinutes += mins
    }
  }

  // Calculate occupied minutes from bookings
  let totalOccupied = 0
  const confirmedBookings = bookings.filter(
    (b) => isInPeriod(b.date, period) && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
  )

  for (const booking of confirmedBookings) {
    const prev = occupiedPerCourt.get(booking.courtId) ?? 0
    occupiedPerCourt.set(booking.courtId, prev + booking.durationMinutes)
    totalOccupied += booking.durationMinutes
  }

  const byCourt = new Map<string, number>()
  for (const court of courts) {
    const total = totalPerCourt.get(court.id) ?? 0
    const occupied = occupiedPerCourt.get(court.id) ?? 0
    byCourt.set(court.id, total > 0 ? Math.round((occupied / total) * 100) : 0)
  }

  const percentage = totalMinutes > 0 ? Math.round((totalOccupied / totalMinutes) * 100) : 0

  return { totalMinutes, occupiedMinutes: totalOccupied, percentage, byCourt }
}

// ── HORARIOS PICO ──────────────────────────────────────────────────────────

export interface HorarioPico {
  hour: number // 8–21 (start hour of the slot)
  label: string // "08:00–09:00"
  count: number // number of bookings starting in this hour
  percentage: number // relative to busiest hour (0–100)
}

/**
 * Calculate peak booking hours.
 * @param bookings  Booking records to analyze
 * @param period    Date range [start, end)
 */
export function calcularHorariosPico(
  bookings: BookingRecord[],
  period: AnalyticsPeriod
): HorarioPico[] {
  const countByHour = new Array(24).fill(0) as number[]

  bookings
    .filter(
      (b) => isInPeriod(b.date, period) && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
    )
    .forEach((b) => {
      const hour = parseInt(b.startTime.split(':')[0] ?? '0', 10)
      countByHour[hour] = (countByHour[hour] ?? 0) + 1
    })

  const maxCount = Math.max(...countByHour)

  return Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00–${String(hour + 1).padStart(2, '0')}:00`,
    count: countByHour[hour] ?? 0,
    percentage: maxCount > 0 ? Math.round(((countByHour[hour] ?? 0) / maxCount) * 100) : 0,
  }))
}

// ── HELPERS DE PERÍODO ─────────────────────────────────────────────────────

/** Returns period covering today (midnight to midnight) in Argentina timezone */
export function periodToday(): AnalyticsPeriod {
  return { start: argToday(), end: argTomorrow() }
}

/** Returns period covering current week (Mon–Sun) in Argentina timezone */
export function periodCurrentWeek(): AnalyticsPeriod {
  const today = argToday()
  const dow = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1 // Mon=0
  const start = new Date(today)
  start.setUTCDate(today.getUTCDate() - dow)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return { start, end }
}

/** Returns period covering current month in Argentina timezone */
export function periodCurrentMonth(): AnalyticsPeriod {
  const today = argToday()
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  return { start, end }
}

/** Returns last N days in Argentina timezone */
export function periodLastNDays(n: number): AnalyticsPeriod {
  const end = argTomorrow()
  const start = new Date(argToday())
  start.setUTCDate(start.getUTCDate() - (n - 1))
  return { start, end }
}

/** Daily breakdown for chart: last 7 days with bookings + bar revenue */
export function calcularIngresosSemanales(
  bookings: BookingRecord[],
  barSales: BarSaleRecord[]
): Array<{ label: string; bookings: number; bar: number; total: number; isToday: boolean }> {
  const todayStr = argTodayStr()
  const today = argToday()

  // Build last 7 days as UTC midnight dates (Argentina calendar)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - (6 - i))
    return d
  })

  const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return days.map((day) => {
    const start = day
    const end = new Date(day)
    end.setUTCDate(end.getUTCDate() + 1)

    const bRev = bookings
      .filter(
        (b) =>
          b.date >= start && b.date < end && (b.status === 'CONFIRMED' || b.status === 'COMPLETED')
      )
      .reduce((s, b) => s + b.totalPrice, 0)

    const bBar = barSales
      .filter((s) => s.createdAt >= start && s.createdAt < end)
      .reduce((s, b) => s + b.total, 0)

    const y = day.getUTCFullYear()
    const m = String(day.getUTCMonth() + 1).padStart(2, '0')
    const d = String(day.getUTCDate()).padStart(2, '0')
    const isToday = `${y}-${m}-${d}` === todayStr

    return {
      label: dow[day.getUTCDay()] ?? '',
      bookings: bRev,
      bar: bBar,
      total: bRev + bBar,
      isToday,
    }
  })
}
