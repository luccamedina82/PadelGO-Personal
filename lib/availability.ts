/**
 * lib/availability.ts — Court slot availability calculator.
 *
 * C-01: Zero Next.js imports. Framework-agnostic pure functions.
 * All logic is pure: receives data as parameters, returns results.
 */

import type { TimeSlot } from '@/types'

// ── CONSTANTS ──────────────────────────────────────────────────────────────

export const VALID_DURATIONS = [60, 90, 120] as const
export type DurationMinutes = (typeof VALID_DURATIONS)[number]

export const DEFAULT_DURATION: DurationMinutes = 90

/** Minimum minutes ahead of now to allow a booking */
export const MIN_ADVANCE_MINUTES = 60

// ── TIME HELPERS ──────────────────────────────────────────────────────────

/** "HH:MM" → minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** minutes from midnight → "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// ── INTERFACES ────────────────────────────────────────────────────────────

export interface ExistingBooking {
  startTime: string // "HH:MM"
  durationMinutes: number
  status: string // "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
}

export interface AvailabilityConfig {
  openTime: string // "08:00"
  closeTime: string // "22:00"
  pricePerHour: number // centavos ARS (Int)
}

// ── MAIN FUNCTION ─────────────────────────────────────────────────────────

/**
 * Calculate bookable time slots for a given court, date, and existing bookings.
 *
 * Rules (C-12):
 * - Slots generated from openTime to closeTime in 30-minute increments
 * - Only slot+duration combos that finish by closeTime are included
 * - Slots with zero valid durations are excluded entirely
 * - Active bookings (PENDING/CONFIRMED) block their time range
 * - Slots within MIN_ADVANCE_MINUTES of `now` are marked unavailable
 *
 * @param config         Availability config for the court + day
 * @param existingBookings  Bookings already created for that court + date
 * @param selectedDate   The date being queried (used for advance-time check)
 * @param now            Reference "now" — defaults to new Date() (injectable for tests)
 */
export function calcAvailableSlots(
  config: AvailabilityConfig,
  existingBookings: ExistingBooking[],
  selectedDate: Date,
  now: Date = new Date()
): TimeSlot[] {
  const openMinutes = timeToMinutes(config.openTime)
  const closeMinutes = timeToMinutes(config.closeTime)

  // Active bookings block slots
  const activeBookings = existingBookings.filter(
    (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
  )

  // For same-day advance check: selectedDate is UTC midnight (Argentina calendar date).
  // Compare both dates in Argentina timezone for correctness regardless of server timezone.
  const bookingDateStr = [
    selectedDate.getUTCFullYear(),
    String(selectedDate.getUTCMonth() + 1).padStart(2, '0'),
    String(selectedDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const nowArgDateStr = now.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const isSameDay = bookingDateStr === nowArgDateStr

  const nowTimeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const [nh, nm] = nowTimeStr.split(':').map(Number)
  const nowMinutes = (nh ?? 0) * 60 + (nm ?? 0)

  const slots: TimeSlot[] = []

  // 30-minute increments from openTime up to (closeTime - smallest duration)
  for (let start = openMinutes; start <= closeMinutes - 60; start += 30) {
    // Which durations fit before closeTime? (C-12)
    const durationOptions = (VALID_DURATIONS as readonly number[]).filter(
      (d) => start + d <= closeMinutes
    ) as number[]

    if (durationOptions.length === 0) continue

    // Is slot too close to now? (1h advance rule, only for same-day)
    const isTooSoon = isSameDay && start < nowMinutes + MIN_ADVANCE_MINUTES

    // Is slot blocked by an existing booking?
    // A new booking of ANY valid duration overlaps if: start < bookingEnd AND slotEnd > bookingStart
    // We use the largest valid duration for the most conservative overlap check.
    const largestDuration = durationOptions[durationOptions.length - 1]
    const slotEndMax = start + largestDuration

    const isBooked = activeBookings.some((booking) => {
      const bStart = timeToMinutes(booking.startTime)
      const bEnd = bStart + booking.durationMinutes
      // Overlap: ranges [start, slotEndMax) and [bStart, bEnd) intersect
      return start < bEnd && slotEndMax > bStart
    })

    const available = !isTooSoon && !isBooked

    slots.push({
      time: minutesToTime(start),
      endTime: minutesToTime(start + DEFAULT_DURATION),
      pricePerHour: config.pricePerHour,
      available,
      durationOptions: available ? durationOptions : [],
    })
  }

  return slots
}

// ── PRICE HELPERS ─────────────────────────────────────────────────────────

/** Calculate total booking price in centavos (C-08) */
export function calcBookingPrice(pricePerHour: number, durationMinutes: number): number {
  return Math.round((pricePerHour / 60) * durationMinutes)
}

/** Format centavos → ARS currency string for display */
export function formatPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

/** Format price per hour for display (e.g. "$7.000/hr") */
export function formatPricePerHour(pricePerHour: number): string {
  return `${formatPrice(pricePerHour)}/hr`
}
