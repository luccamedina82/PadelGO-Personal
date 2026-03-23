/**
 * lib/date.ts — Timezone-safe date helpers for Argentina (America/Argentina/Buenos_Aires, UTC-3).
 *
 * All dates stored in DB (Booking.date, RecurringBooking.startDate, etc.) are
 * UTC midnight. These helpers ensure "today", "now", and date comparisons are
 * always evaluated in Argentina local time, regardless of the server's timezone.
 */

const TZ = 'America/Argentina/Buenos_Aires'

/**
 * Returns the current date as UTC midnight, evaluated in Argentina timezone.
 *
 * Example at 23:30 ARG (02:30 UTC next day):
 *   → returns UTC midnight of the Argentina calendar date (not the UTC date)
 *
 * Use this instead of:
 *   const d = new Date(); d.setHours(0,0,0,0)    ← broken if server is UTC
 *   const d = new Date(); d.setUTCHours(0,0,0,0) ← broken after 21:00 ARG
 */
export function argToday(): Date {
  // 'en-CA' locale produces "YYYY-MM-DD" format
  const argDateStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  return new Date(`${argDateStr}T00:00:00.000Z`)
}

/**
 * Returns tomorrow's date as UTC midnight, in Argentina timezone.
 */
export function argTomorrow(): Date {
  const today = argToday()
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/**
 * Returns minutes elapsed since midnight in Argentina timezone.
 * Use this for "is this booking in progress now?" comparisons.
 *
 * Use this instead of: new Date().getHours() * 60 + new Date().getMinutes()
 */
export function argNowMinutes(): number {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const [h, m] = timeStr.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Returns current hours and minutes in Argentina timezone as an object.
 */
export function argNowTime(): { hours: number; minutes: number } {
  const mins = argNowMinutes()
  return { hours: Math.floor(mins / 60), minutes: mins % 60 }
}

/**
 * Returns "YYYY-MM-DD" string for today in Argentina timezone.
 * Use this for <input type="date" min={...}> and similar UI defaults.
 *
 * Use this instead of:
 *   const d = new Date()
 *   `${d.getFullYear()}-${...getMonth()}-${...getDate()}`  ← local, not ARG
 */
export function argTodayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * Returns the Argentina calendar date string "YYYY-MM-DD" for any Date object.
 * Useful when formatting a UTC timestamp for display in Argentina.
 */
export function toArgDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * Returns a UTC date key "YYYY-MM-DD" from a Date value.
 * Use this for DB fields stored as UTC midnight (e.g. Booking.date).
 */
export function toUtcDateStr(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Checks whether a Booking.date (UTC midnight) falls on today in Argentina.
 * Booking.date uses UTC midnight, so compare using getUTC* methods.
 */
export function isArgToday(bookingDate: Date): boolean {
  const todayStr = argTodayStr()
  const y = bookingDate.getUTCFullYear()
  const m = String(bookingDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bookingDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}` === todayStr
}

/**
 * Returns an AnalyticsPeriod-compatible { start, end } for "today" in Argentina.
 * start = UTC midnight of today (ARG), end = UTC midnight of tomorrow (ARG).
 */
export function argPeriodToday(): { start: Date; end: Date } {
  return { start: argToday(), end: argTomorrow() }
}

/**
 * Returns a date N days ago from today in Argentina timezone, as UTC midnight.
 * Use this for filtering queries like "bookings from the last 35 days".
 */
export function argDaysAgo(days: number): Date {
  const today = argToday()
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}
