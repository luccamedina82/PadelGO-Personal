// lib/recurring.ts — Zero Next.js imports (C-01)
// Utilities for recurring (turno fijo) booking logic.

/** How many weeks ahead to materialise when creating a recurring booking. */
export const RECURRING_WEEKS_AHEAD = 8

/**
 * Returns the next `count` UTC midnight Date objects for a given day-of-week,
 * starting from (and including) `from`.
 *
 * @param dayOfWeek  0=Sun … 6=Sat  (matches JS getUTCDay())
 * @param from       Start date (UTC midnight). First returned date is >= this.
 * @param count      Number of occurrences to generate.
 */
export function getNextOccurrences(dayOfWeek: number, from: Date, count: number): Date[] {
  const results: Date[] = []
  // Normalise to UTC midnight
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))

  // Advance to the first matching day-of-week
  const daysUntil = (dayOfWeek - cursor.getUTCDay() + 7) % 7
  cursor.setUTCDate(cursor.getUTCDate() + daysUntil)

  for (let i = 0; i < count; i++) {
    results.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return results
}

/**
 * Returns all UTC midnight Date objects for a given day-of-week in [from, to).
 */
export function getOccurrencesInRange(dayOfWeek: number, from: Date, to: Date): Date[] {
  const results: Date[] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))

  // Advance to the first matching day-of-week
  const daysUntil = (dayOfWeek - cursor.getUTCDay() + 7) % 7
  cursor.setUTCDate(cursor.getUTCDate() + daysUntil)

  while (cursor < to) {
    results.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return results
}
